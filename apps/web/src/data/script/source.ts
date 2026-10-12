import "server-only"

import { cache } from "react"
import { z } from "zod"

import { boardOf } from "@/lib/script"

import sourcesJson from "../content/script-sources.json"
import { parseLedger } from "./ledger"
import {
  scriptActivationSchema,
  scriptArchitecturesSchema,
  scriptBenchmarkSchema,
  scriptContentSchema,
  scriptLeaderboardSchema,
  scriptManifestSchema,
  scriptSourcesSchema,
  scriptStartingBoardSchema,
  scriptTargetsSchema,
  type Instance,
  type ScriptChallenge,
  type ScriptTrack,
} from "./schema"

const REVALIDATE_SECONDS = 300
const REF_REVALIDATE_SECONDS = 60
const SOURCES_PATH = "data/site/sources.json"
const commitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }),
})
const repositories = z
  .object({ repositories: z.array(z.url()) })
  .parse(sourcesJson)
  .repositories.map((url) => ({ url, name: new URL(url).pathname.replace(/^\//, "") }))

function fill(template: string, values: Record<string, string>): string {
  return template.replaceAll(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

/** Every challenge in one repository, with all of its tracks, read at one immutable commit. */
async function readRepository(url: string, name: string): Promise<ScriptChallenge[]> {
  const token = process.env["GITHUB_READ_TOKEN"]
  const auth: Record<string, string> =
    token === undefined || token === "" ? {} : { Authorization: `Bearer ${token}` }
  const refResponse = await fetch(`https://api.github.com/repos/${name}/commits/main`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...auth,
    },
    next: { revalidate: REF_REVALIDATE_SECONDS },
  })
  if (!refResponse.ok) throw new Error(`${name} commit API: ${String(refResponse.status)}`)
  const {
    sha,
    commit: {
      committer: { date: repositoryDate },
    },
  } = commitSchema.parse(await refResponse.json())
  const read = async (path: string): Promise<string> => {
    const response = await fetch(`https://raw.githubusercontent.com/${name}/${sha}/${path}`, {
      headers: auth,
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) throw new Error(`${name} ${path}: ${String(response.status)}`)
    return response.text()
  }
  const json = async (path: string): Promise<unknown> => JSON.parse(await read(path)) as unknown

  /**
   * The starting board as instances: measurements on public lanes that the judge has not
   * recorded. Each takes its architecture and attribution from its submission manifest.
   */
  const startingBoard = async (
    path: string,
  ): Promise<{ instances: Instance[]; baselines: Map<string, string> }> => {
    const { candidates } = scriptStartingBoardSchema.parse(await json(path))
    const directory = path.replace(/[^/]+$/, "submissions")
    const instances = await Promise.all(
      candidates.map(async (candidate): Promise<Instance> => {
        const manifest = scriptManifestSchema.parse(
          await json(`${directory}/${candidate.submission}/submission.json`),
        )
        return {
          unixTime: Math.floor(Date.parse(repositoryDate) / 1000),
          track: candidate.track,
          architecture: manifest.architecture,
          bytes: candidate.local.bytes,
          opcodes: candidate.local.opcodes,
          workBits: candidate.local.workBits,
          score: candidate.local.score,
          securityBits: candidate.local.securityBits,
          lanes: candidate.local.lanes,
          engine: candidate.local.engine,
          instanceSha256: candidate.instanceSha256,
          verifierSha256: candidate.local.verifierSha256,
          pr: null,
          author: manifest.authors[0] ?? null,
          model: manifest.model,
          harness: manifest.harness,
          submission: candidate.submission,
          note: manifest.title,
          provisional: true,
        }
      }),
    )
    const baselines = new Map(
      candidates
        .filter((candidate) => candidate.role === "baseline")
        .map((candidate) => [candidate.track, candidate.submission]),
    )
    return { instances, baselines }
  }

  const sources = scriptSourcesSchema.parse(await json(SOURCES_PATH))
  const activation = scriptActivationSchema.parse(await json(sources.activation))
  const routes = await Promise.all(
    Object.entries(sources.challenges).map(async ([id, paths]) => {
      const [benchmarkRaw, architecturesRaw, targetsRaw, leaderboardRaw, contentRaw, ledgerText] =
        await Promise.all([
          json(paths.benchmark),
          json(paths.architectures),
          json(paths.targets),
          json(paths.leaderboard),
          json(paths.content),
          read(paths.ledger),
        ])
      const benchmark = scriptBenchmarkSchema.parse(benchmarkRaw)
      const { architectures } = scriptArchitecturesSchema.parse(architecturesRaw)
      const targets = scriptTargetsSchema.parse(targetsRaw)
      const leaderboard = scriptLeaderboardSchema.parse(leaderboardRaw)
      const content = scriptContentSchema.parse(contentRaw)
      const recorded = parseLedger(ledgerText)
      if (recorded.length !== leaderboard.ledgerRows)
        throw new Error(`${name} ${id}: the leaderboard is stale against the ledger`)
      const starting =
        paths.startingBoard === undefined
          ? { instances: [], baselines: new Map<string, string>() }
          : await startingBoard(paths.startingBoard)
      const tracks = content.tracks.flatMap((track): ScriptTrack[] => {
        const board = leaderboard.tracks.find((item) => item.track === track.id)
        const contract = benchmark.tracks.find((item) => item.name === track.id)
        if (board === undefined || contract === undefined) return []
        const rows = recorded.filter((instance) => instance.track === track.id)
        // Rows win. Until a track has one, its starting board stands in, marked as such.
        const provisional = rows.length === 0
        const instances = provisional
          ? starting.instances.filter((instance) => instance.track === track.id)
          : rows
        const baseline = provisional
          ? (starting.baselines.get(track.id) ?? null)
          : (board.baseline?.submission ?? null)
        return [
          {
            id: track.id,
            name: track.name,
            headline: track.headline,
            summary: track.summary,
            spec: board.spec,
            model: contract.standard.model,
            floorBits: contract.standard.floorBits,
            instances,
            provisional: provisional && instances.length > 0,
            ...boardOf(instances, architectures, baseline),
            targets: targets.targets.filter((target) => target.track === track.id),
          },
        ]
      })
      if (tracks.length === 0) return []
      const challenge: ScriptChallenge = {
        kind: "script",
        slug: id,
        name: content.name,
        group: content.group,
        headline: content.headline,
        summary: content.summary,
        // A challenge is only as live as the repository's activation record says.
        status: activation.status === "live" ? benchmark.status : activation.status,
        gates: activation.gates,
        content,
        benchmark,
        tracks,
        architectures,
        targetConventions: targets.conventions,
        links: content.links,
        repositoryCommit: sha,
        repositoryDate,
        agentPrompt: fill(content.agentPrompt, {
          track: tracks.map((track) => track.id).join(" or "),
          repositoryUrl: url,
          name: content.name,
        }),
      }
      return [challenge]
    }),
  )
  return routes.flat()
}

/**
 * Script challenges from every configured repository. A repository that cannot be read (not
 * yet public, or GitHub is unavailable) is skipped with a warning, so the rest of the site
 * still renders; nothing is ever shown from a partially read repository.
 */
export const getScriptChallenges = cache(async (): Promise<ScriptChallenge[]> => {
  const results = await Promise.all(
    repositories.map(async ({ url, name }) => {
      try {
        return await readRepository(url, name)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`Script challenges from ${name} are unavailable: ${reason}`)
        return []
      }
    }),
  )
  return results.flat()
})

export const getScriptChallenge = cache(
  async (slug: string): Promise<ScriptChallenge | null> =>
    (await getScriptChallenges()).find((challenge) => challenge.slug === slug) ?? null,
)
