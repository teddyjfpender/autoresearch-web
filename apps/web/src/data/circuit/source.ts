import "server-only"

import { cache } from "react"
import { z } from "zod"

import sourcesJson from "../content/circuit-sources.json"
import { parseLedger } from "./ledger"
import {
  circuitActivationSchema,
  circuitArchitecturesSchema,
  circuitBenchmarkSchema,
  circuitContentSchema,
  circuitLeaderboardSchema,
  circuitSourcesSchema,
  circuitTargetsSchema,
  type CircuitChallenge,
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

/** Every track of every challenge in one repository, read at one immutable commit. */
async function readRepository(url: string, name: string): Promise<CircuitChallenge[]> {
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

  const sources = circuitSourcesSchema.parse(await json(SOURCES_PATH))
  const activation = circuitActivationSchema.parse(await json(sources.activation))
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
      const benchmark = circuitBenchmarkSchema.parse(benchmarkRaw)
      const { architectures } = circuitArchitecturesSchema.parse(architecturesRaw)
      const targets = circuitTargetsSchema.parse(targetsRaw)
      const leaderboard = circuitLeaderboardSchema.parse(leaderboardRaw)
      const content = circuitContentSchema.parse(contentRaw)
      const circuits = parseLedger(ledgerText)
      if (circuits.length !== leaderboard.ledgerRows)
        throw new Error(`${name} ${id}: the leaderboard is stale against the ledger`)
      const siblings = content.tracks.map((track) => ({
        slug: `${id}-${track.id}`,
        id: track.id,
        name: track.name,
      }))
      return content.tracks.flatMap((track): CircuitChallenge[] => {
        const board = leaderboard.tracks.find((item) => item.track === track.id)
        if (board === undefined) return []
        return [
          {
            kind: "circuit",
            slug: `${id}-${track.id}`,
            challengeId: id,
            trackId: track.id,
            name: `${content.name} · ${track.name}`,
            trackName: track.name,
            group: content.group,
            headline: track.headline,
            summary: `${content.headline} ${track.summary}`,
            // A challenge is only as live as the repository's activation record says.
            status: activation.status === "live" ? benchmark.status : activation.status,
            gates: activation.gates,
            content,
            benchmark,
            board,
            circuits: circuits.filter((circuit) => circuit.track === track.id),
            architectures,
            targets: targets.targets.filter((target) => target.track === track.id),
            targetConventions: targets.conventions,
            siblings,
            links: content.links,
            repositoryCommit: sha,
            repositoryDate,
            agentPrompt: fill(content.agentPrompt, {
              track: track.id,
              repositoryUrl: url,
              name: content.name,
            }),
          },
        ]
      })
    }),
  )
  return routes.flat()
}

/**
 * Circuit challenges from every configured repository. A repository that cannot be read (not
 * yet public, or GitHub is unavailable) is skipped with a warning, so the rest of the site
 * still renders; nothing is ever shown from a partially read repository.
 */
export const getCircuitChallenges = cache(async (): Promise<CircuitChallenge[]> => {
  const results = await Promise.all(
    repositories.map(async ({ url, name }) => {
      try {
        return await readRepository(url, name)
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        console.warn(`Circuit challenges from ${name} are unavailable: ${reason}`)
        return []
      }
    }),
  )
  return results.flat()
})

export const getCircuitChallenge = cache(
  async (slug: string): Promise<CircuitChallenge | null> =>
    (await getCircuitChallenges()).find((challenge) => challenge.slug === slug) ?? null,
)
