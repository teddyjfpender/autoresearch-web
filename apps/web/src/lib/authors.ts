import type { Author } from "@/data/schema"

export function submitterOf(authors: readonly Author[]): Author {
  const submitter = authors.find((author) => author.role === "submitter") ?? authors[0]
  if (!submitter) throw new Error("Submission without authors")
  return submitter
}

/** "alice", "alice & bob", "alice + 2 others" */
export function authorLine(authors: readonly Author[]): string {
  const lead = submitterOf(authors).handle
  const rest = authors.length - 1
  if (rest === 0) return lead
  return rest === 1
    ? `${lead} & ${authors.find((a) => a.handle !== lead)?.handle ?? ""}`
    : `${lead} + ${String(rest)} others`
}
