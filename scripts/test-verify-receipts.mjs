import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = join(dirname(fileURLToPath(import.meta.url)), "verify-receipts.mjs")
const root = mkdtempSync(join(tmpdir(), "verify-receipts-"))
const imported = join(root, "apps/web/src/data/imported/stwo-cuda")
const receipts = join(root, "apps/web/public/receipts")
mkdirSync(imported, { recursive: true })
mkdirSync(receipts, { recursive: true })

try {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519")
  const keyId = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
  const id = "1".repeat(20)
  const patch = "b".repeat(64)
  const commit = "a".repeat(40)
  const source = "c".repeat(40)
  const repository = "https://github.com/alice/fork.git"
  const track = { eligible: true, score: 1.2, promotable_against_baseline: true }
  const perCase = [{ id: "pie:test", time_ratio: 0.8, memory_ratio: 0.9 }]
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
      public_per_case: perCase,
    },
  }
  const raw = Buffer.from(JSON.stringify(receipt))
  const digest = createHash("sha256").update(raw).digest("hex")
  const signature = sign(null, raw, privateKey)
  const envelope = {
    schema: "stwo-cuda-receipt-signature-v1",
    algorithm: "Ed25519",
    receipt_sha256: digest,
    key_id: keyId,
    signature_base64: signature.toString("base64"),
  }
  const card = {
    id,
    patchSha256: patch,
    repositoryUrl: repository,
    commit,
    receiptSha256: digest,
    receiptKeyId: keyId,
    rTime: 0.8,
    rMemory: 0.9,
    tracks: Object.fromEntries(
      Object.entries(receipt.scores.tracks).map(([name, value]) => [
        name,
        {
          eligible: value.eligible,
          score: value.score,
          promotableAgainstBaseline: value.promotable_against_baseline,
        },
      ]),
    ),
    promotedTracks: ["latency"],
    perCase: [{ caseId: "pie:test", timeRatio: 0.8, memoryRatio: 0.9 }],
  }
  writeFileSync(
    join(imported, "contract.json"),
    JSON.stringify({ contractEpoch: "test-v1", sourceCommit: source }),
  )
  writeFileSync(
    join(imported, "operator-public.pem"),
    publicKey.export({ type: "spki", format: "pem" }),
  )
  writeFileSync(join(receipts, `${digest}.json`), raw)
  writeFileSync(join(receipts, `${digest}.signature.json`), JSON.stringify(envelope))
  const cardsPath = join(imported, "scorecards.json")
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" })
  writeFileSync(cardsPath, JSON.stringify([card]))
  assert.equal(run().status, 0, "signed aggregate should pass")
  writeFileSync(cardsPath, JSON.stringify([{ ...card, rTime: 0.7 }]))
  assert.notEqual(run().status, 0, "tampered aggregate must fail")
  console.log("Receipt import verification passed")
} finally {
  rmSync(root, { recursive: true, force: true })
}
