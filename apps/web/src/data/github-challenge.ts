import "server-only"

import { cache } from "react"
import { z } from "zod"

import { challengeSourceManifestSchema, parseChallengeFiles } from "./challenge-parser"
import { verifyScorecards } from "./verify-scorecards"
import stwoCudaContent from "./content/challenges/stwo-cuda/challenge.json"

const REVALIDATE_SECONDS = 300
const REF_REVALIDATE_SECONDS = 60
const REPOSITORY = new URL(stwoCudaContent.links.repo).pathname.replace(/^\//, "")
const SOURCES_PATH = "data/site/sources.json"
const commitSchema = z.object({ sha: z.string().regex(/^[0-9a-f]{40}$/) })

/** One immutable repository revision supplies every measured value on both site routes. */
export const getChallengeRepositoryData = cache(async () => {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
  const token = process.env["GITHUB_READ_TOKEN"]
  if (token !== undefined && token !== "") headers["Authorization"] = `Bearer ${token}`
  const refResponse = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/commits/main?site-feed=v3`,
    {
      headers,
      next: { revalidate: REF_REVALIDATE_SECONDS },
    },
  )
  if (!refResponse.ok)
    throw new Error(`Challenge repository commit API: ${String(refResponse.status)}`)
  const { sha } = commitSchema.parse(await refResponse.json())

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
  return { ...parsed, scorecards, repositoryCommit: sha }
})
