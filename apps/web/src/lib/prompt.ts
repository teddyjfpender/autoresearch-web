import type { Challenge } from "@/data/schema"

/** Fill a challenge's agent prompt template for one backend route. */
export function agentPrompt(challenge: Challenge): string {
  const repo = new URL(challenge.links.repo).pathname.split("/").at(-1) ?? ""
  const values: Record<string, string> = {
    name: challenge.name,
    backend: challenge.backend,
    BACKEND: challenge.backend.toUpperCase(),
    host: challenge.contract.hardware.gpu,
    repositoryUrl: challenge.links.repo,
    repo,
  }
  return challenge.agentPrompt.replaceAll(
    /\{(\w+)\}/g,
    (match, key: string) => values[key] ?? match,
  )
}
