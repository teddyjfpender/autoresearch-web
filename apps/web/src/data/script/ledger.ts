import type { Instance } from "./schema"

const REQUIRED = [
  "unix_time",
  "track",
  "architecture",
  "bytes",
  "opcodes",
  "work_bits",
  "score",
  "security_bits",
  "lanes",
  "engine",
  "instance_sha256",
  "verifier_sha256",
  "pr",
  "author",
  "model",
  "harness",
  "submission",
  "kind",
  "status",
  "note",
] as const

/**
 * Parse a challenge ledger (`results.tsv`): tab-separated, header row, no quoting. Only `OK`
 * rows exist in a ledger; anything unreadable throws rather than being skipped.
 */
export function parseLedger(text: string): Instance[] {
  const lines = text.split("\n").filter((line) => line !== "")
  const header = lines[0]?.split("\t") ?? []
  for (const column of REQUIRED)
    if (!header.includes(column)) throw new Error(`Ledger is missing the column ${column}`)
  const at = (cells: string[], column: (typeof REQUIRED)[number]) =>
    cells[header.indexOf(column)] ?? ""
  return lines.slice(1).map((line, index) => {
    const cells = line.split("\t")
    if (cells.length !== header.length)
      throw new Error(`Ledger line ${String(index + 2)} has ${String(cells.length)} cells`)
    const bytes = Number(at(cells, "bytes"))
    const opcodes = Number(at(cells, "opcodes"))
    const workBits = Number(at(cells, "work_bits"))
    if (
      !Number.isInteger(bytes) ||
      bytes <= 0 ||
      !Number.isInteger(opcodes) ||
      opcodes <= 0 ||
      !(workBits > 0)
    )
      throw new Error(`Ledger line ${String(index + 2)} has unreadable counts`)
    const pr = at(cells, "pr")
    const text_ = (column: (typeof REQUIRED)[number]) => {
      const value = at(cells, column)
      return value === "" ? null : value
    }
    return {
      unixTime: Number(at(cells, "unix_time")),
      track: at(cells, "track"),
      architecture: at(cells, "architecture"),
      bytes,
      opcodes,
      workBits,
      score: Number(at(cells, "score")),
      securityBits: Number(at(cells, "security_bits")),
      lanes: Number(at(cells, "lanes")),
      engine: at(cells, "engine"),
      instanceSha256: at(cells, "instance_sha256"),
      verifierSha256: at(cells, "verifier_sha256"),
      pr: /^\d+$/.test(pr) ? Number(pr) : null,
      author: text_("author"),
      model: text_("model"),
      harness: text_("harness"),
      submission: at(cells, "submission"),
      note: at(cells, "note"),
      provisional: false,
    }
  })
}
