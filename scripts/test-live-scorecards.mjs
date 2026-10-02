import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"

import { verifyScorecards } from "../apps/web/src/data/verify-scorecards.ts"

const { privateKey, publicKey } = generateKeyPairSync("ed25519")
const id = "1".repeat(20)
const patch = "b".repeat(64)
const commit = "a".repeat(40)
const source = "c".repeat(40)
const repository = "https://github.com/alice/fork.git"
const track = { eligible: true, score: 1.25, promotable_against_baseline: true }
const receipt = {
  schema: "stwo-cuda-public-receipt-v1",
  tier: "rank",
  submission_id: id,
  contract_epoch: "test-v1",
  source_commit: source,
  repository,
  commit_sha: commit,
  patch_sha256: patch,
  holdout_case_count: 1,
  scores: {
    r_time: 0.8,
    r_memory: 0.9,
    tracks: { latency: track, memory: track, balanced: track },
    public_per_case: [{ id: "pie:test", time_ratio: 0.8, memory_ratio: 0.9 }],
  },
}
const raw = Buffer.from(JSON.stringify(receipt))
const digest = createHash("sha256").update(raw).digest("hex")
const keyId = createHash("sha256")
  .update(publicKey.export({ type: "spki", format: "der" }))
  .digest("hex")
const envelope = {
  schema: "stwo-cuda-receipt-signature-v1",
  algorithm: "Ed25519",
  receipt_sha256: digest,
  key_id: keyId,
  signature_base64: sign(null, raw, privateKey).toString("base64"),
}
const card = {
  id,
  submittedAt: "2026-10-02T11:00:00Z",
  authors: [{ handle: "alice", role: "submitter" }],
  model: null,
  title: "Faster CUDA",
  notes: "Verified",
  commit,
  patchSha256: patch,
  repositoryUrl: repository,
  prNumber: 7,
  prUrl: "https://github.com/owner/challenge/pull/7",
  receiptSha256: digest,
  receiptKeyId: keyId,
  rTime: 0.8,
  rMemory: 0.9,
  tracks: Object.fromEntries(
    Object.entries(receipt.scores.tracks).map(([name, signed]) => [
      name,
      {
        eligible: signed.eligible,
        score: signed.score,
        promotableAgainstBaseline: signed.promotable_against_baseline,
      },
    ]),
  ),
  promotedTracks: ["latency"],
  perCase: [{ caseId: "pie:test", timeRatio: 0.8, memoryRatio: 0.9 }],
}
const contract = {
  contractEpoch: "test-v1",
  baselineMeasuredAt: "2026-10-02",
  baselineQualification: "test",
  sourceRepository: "https://github.com/owner/source",
  sourceCommit: source,
  editablePaths: ["src/backends/cuda"],
  hardware: { gpu: "NVIDIA H200", deviceBytes: 100, reserveBytes: 1 },
  security: {
    friQueries: 70,
    queryPowBits: 26,
    interactionPowBits: 24,
    preprocessedVariant: "canonical",
  },
}
const files = new Map([
  ["data/site/operator-public.pem", Buffer.from(publicKey.export({ type: "spki", format: "pem" }))],
  [`data/site/receipts/${digest}.json`, raw],
  [`data/site/receipts/${digest}.signature.json`, Buffer.from(JSON.stringify(envelope))],
])
const read = async (path) => {
  const bytes = files.get(path)
  if (!bytes) throw new Error(`Missing test artifact: ${path}`)
  return bytes
}
assert.deepEqual(await verifyScorecards([card], contract, ["pie:test"], read), [card])
await assert.rejects(verifyScorecards([{ ...card, rTime: 0.7 }], contract, ["pie:test"], read))
await assert.rejects(verifyScorecards([card], contract, ["pie:other"], read))
files.set(
  `data/site/receipts/${digest}.signature.json`,
  Buffer.from(JSON.stringify({ ...envelope, signature_base64: "AA==" })),
)
await assert.rejects(verifyScorecards([card], contract, ["pie:test"], read))
console.log("Live signed scorecard verification passed")
