import type { Circuit } from "./schema"

const REQUIRED = [
  "unix_time",
  "track",
  "architecture",
  "toffoli",
  "qubits",
  "score",
  "samples",
  "engine",
  "ops_sha256",
  "verifier_sha256",
  "commit",
  "pr",
  "author",
  "model",
  "harness",
  "submission",
  "kind",
  "standing",
  "status",
  "note",
] as const

/**
 * Parse a challenge ledger (`results.tsv`): tab-separated, header row, no quoting. Only `OK`
 * rows exist in a ledger; anything unreadable throws rather than being skipped.
 */
export function parseLedger(text: string): Circuit[] {
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
    const toffoli = Number(at(cells, "toffoli"))
    const qubits = Number(at(cells, "qubits"))
    const kind = at(cells, "kind")
    if (!(toffoli > 0) || !Number.isInteger(qubits) || qubits <= 0)
      throw new Error(`Ledger line ${String(index + 2)} has unreadable counts`)
    if (kind !== "historical" && kind !== "submission")
      throw new Error(`Ledger line ${String(index + 2)} has an unknown kind`)
    const pr = at(cells, "pr")
    const text_ = (column: (typeof REQUIRED)[number]) => {
      const value = at(cells, column)
      return value === "" ? null : value
    }
    return {
      unixTime: Number(at(cells, "unix_time")),
      track: at(cells, "track"),
      architecture: at(cells, "architecture"),
      toffoli,
      qubits,
      toffoliTimesQubits: toffoli * qubits,
      score: Number(at(cells, "score")),
      samples: Number(at(cells, "samples")),
      engine: at(cells, "engine"),
      opsSha256: at(cells, "ops_sha256"),
      verifierSha256: at(cells, "verifier_sha256"),
      commit: at(cells, "commit"),
      pr: /^\d+$/.test(pr) ? Number(pr) : null,
      author: text_("author"),
      model: text_("model"),
      harness: text_("harness"),
      submission: at(cells, "submission"),
      kind,
      standing: at(cells, "standing").split(",").filter(Boolean),
      note: at(cells, "note"),
    }
  })
}
