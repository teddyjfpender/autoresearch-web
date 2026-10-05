import "server-only"

import { cache } from "react"
import { z } from "zod"

import { challengeSourceManifestSchema, parseChallengeFiles } from "./challenge-parser"
import {
  parseObservations,
  parseProofResearch,
  proofContractSchema,
  proofFixtureSchema,
  type ProofObservation,
} from "./proof-parser"
import { cspContractSchema, cspFixtureSchema, parseCspObservations } from "./csp-parser"
import { verifyScorecards } from "./verify-scorecards"
import stwoContent from "./content/challenges/stwo/challenge.json"

const REVALIDATE_SECONDS = 300
const REF_REVALIDATE_SECONDS = 60
const REPOSITORY = new URL(stwoContent.links.repo).pathname.replace(/^\//, "")
const SOURCES_PATH = "data/site/sources.json"
const commitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  commit: z.object({ committer: z.object({ date: z.iso.datetime() }) }),
})

/** One immutable repository revision supplies every measured value on both site routes. */
export const getChallengeRepositoryData = cache(async () => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const token = process.env["GITHUB_READ_TOKEN"]
  if (token !== undefined && token !== "") headers["Authorization"] = `Bearer ${token}`
  const refResponse = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/commits/main?site-feed=v4`,
    {
      headers,
      next: { revalidate: REF_REVALIDATE_SECONDS },
    },
  )
  if (!refResponse.ok)
    throw new Error(`Challenge repository commit API: ${String(refResponse.status)}`)
  const {
    sha,
    commit: {
      committer: { date: repositoryDate },
    },
  } = commitSchema.parse(await refResponse.json())

  const readArtifact = async (path: string): Promise<Uint8Array> => {
    const response = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!response.ok) throw new Error(`Challenge repository ${path}: ${String(response.status)}`)
    return new Uint8Array(await response.arrayBuffer())
  }
  const sources = challengeSourceManifestSchema.parse(
    JSON.parse(Buffer.from(await readArtifact(SOURCES_PATH)).toString("utf8")),
  )
  const paths = [
    sources.activation,
    sources.benchmark,
    sources.fixture,
    sources.report,
    sources.summary,
    sources.runs,
    sources.reviews,
    sources.research,
    sources.ingressStudy,
    sources.scorecards,
  ]
  const contents = await Promise.all(
    paths.map(
      async (path) => [path, Buffer.from(await readArtifact(path)).toString("utf8")] as const,
    ),
  )
  const files = Object.fromEntries(contents)
  const parsed = parseChallengeFiles(files, sources)
  const scorecards = await verifyScorecards(
    JSON.parse(files[sources.scorecards] ?? "null"),
    parsed.contract,
    parsed.cases.map((item) => item.id),
    readArtifact,
  )

  // --- proof-only epoch (optional) -------------------------------------------------------------
  const readOptional = async (path: string): Promise<string | null> => {
    const response = await fetch(`https://raw.githubusercontent.com/${REPOSITORY}/${sha}/${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    })
    return response.ok ? Buffer.from(await response.arrayBuffer()).toString("utf8") : null
  }
  const proofBenchmarkPath = sources.proofBenchmark ?? "benchmark-proof-v2.json"
  const proofBenchmarkText = await readOptional(proofBenchmarkPath)
  const proofContract =
    proofBenchmarkText === null ? null : proofContractSchema.parse(JSON.parse(proofBenchmarkText))
  const fixturePath =
    sources.proofFixture ??
    (proofBenchmarkText === null
      ? null
      : (z.object({ fixtureManifest: z.string() }).loose().safeParse(JSON.parse(proofBenchmarkText))
          .data?.fixtureManifest ?? null))
  const fixtureText = fixturePath === null ? null : await readOptional(fixturePath)
  const proofFixture =
    fixtureText === null ? null : proofFixtureSchema.parse(JSON.parse(fixtureText))

  // Observation tables: listed in the manifest, else discovered as report summaries that
  // carry a backend column.
  const observationPaths =
    sources.proofObservations ?? (await discoverObservationTables(headers, sha))
  const proofObservations: ProofObservation[] = (
    await Promise.all(
      observationPaths.map(async (path) => {
        const text = await readOptional(path)
        return text === null ? [] : parseObservations(path, text)
      }),
    )
  ).flat()

  const proofResearch = (
    await Promise.all(
      (sources.proofResearchObservations ?? []).map(async (path) => {
        const text = await readOptional(path)
        return text === null ? [] : parseProofResearch(text)
      }),
    )
  ).flat()

  // --- RISC-V CSP track (optional) --------------------------------------------------------------
  const readJson = async (path: string | undefined) => {
    const text = path === undefined ? null : await readOptional(path)
    return text === null ? null : (JSON.parse(text) as unknown)
  }
  const [cspBenchmark, cspFixtureRaw] = await Promise.all([
    readJson(sources.riscvCspBenchmark),
    readJson(sources.riscvCspFixture),
  ])
  const cspObservations = (
    await Promise.all(
      (sources.riscvCspObservations ?? []).map(async (path) => {
        const text = await readOptional(path)
        return text === null ? [] : parseCspObservations(path, text)
      }),
    )
  ).flat()
  const csp =
    cspBenchmark === null || cspFixtureRaw === null
      ? null
      : {
          contract: cspContractSchema.parse(cspBenchmark),
          fixture: cspFixtureSchema.parse(cspFixtureRaw),
          observations: cspObservations,
        }

  return {
    ...parsed,
    scorecards,
    proofResearch,
    csp,
    repositoryCommit: sha,
    repositoryDate,
    proofContract,
    proofFixture,
    proofObservations,
  }
})

const contentsSchema = z.array(z.object({ name: z.string(), path: z.string(), type: z.string() }))

/** Report directories whose `summary.tsv` might hold per-backend proof observations. */
async function discoverObservationTables(
  headers: Record<string, string>,
  sha: string,
): Promise<string[]> {
  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/contents/data/reports?ref=${sha}`,
    { headers, next: { revalidate: REVALIDATE_SECONDS } },
  )
  if (!response.ok) return []
  const parsed = contentsSchema.safeParse(await response.json())
  if (!parsed.success) return []
  return parsed.data
    .filter((entry) => entry.type === "dir")
    .map((entry) => `${entry.path}/summary.tsv`)
}
