import assert from "node:assert/strict"
import { createHash, createPublicKey, verify } from "node:crypto"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const imported = join(root, "apps/web/src/data/imported/stwo-cuda")
const contract = JSON.parse(readFileSync(join(imported, "contract.json"), "utf8"))
const cards = JSON.parse(readFileSync(join(imported, "scorecards.json"), "utf8"))
if (!Array.isArray(cards)) throw new Error("scorecards.json must be an array")

if (cards.length > 0) {
  const publicKey = createPublicKey(readFileSync(join(imported, "operator-public.pem")))
  const keyId = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
  const seen = new Set()
  for (const card of cards) {
    if (seen.has(card.id)) throw new Error(`duplicate scorecard ${card.id}`)
    seen.add(card.id)
    const receiptPath = join(root, "apps/web/public/receipts", `${card.receiptSha256}.json`)
    const raw = readFileSync(receiptPath)
    const digest = createHash("sha256").update(raw).digest("hex")
    assert.equal(digest, card.receiptSha256, "receipt digest differs")
    const envelope = JSON.parse(
      readFileSync(receiptPath.replace(/\.json$/, ".signature.json"), "utf8"),
    )
    assert.equal(envelope.schema, "stwo-cuda-receipt-signature-v1")
    assert.equal(envelope.algorithm, "Ed25519")
    assert.equal(envelope.receipt_sha256, digest)
    assert.equal(envelope.key_id, keyId)
    assert.equal(card.receiptKeyId, keyId)
    const signature = Buffer.from(envelope.signature_base64, "base64")
    assert.equal(signature.length, 64)
    if (!verify(null, raw, publicKey, signature)) throw new Error("invalid receipt signature")
    const receipt = JSON.parse(raw.toString("utf8"))
    assert.equal(receipt.schema, "stwo-cuda-public-receipt-v1")
    assert.equal(receipt.tier, "rank")
    assert.equal(receipt.submission_id, card.id)
    assert.equal(receipt.patch_sha256, card.patchSha256)
    assert.equal(receipt.repository, card.repositoryUrl)
    assert.equal(receipt.commit_sha, card.commit)
    assert.equal(receipt.source_commit, contract.sourceCommit)
    assert.equal(receipt.contract_epoch, contract.contractEpoch)
    assert.ok(receipt.holdout_case_count > 0)
    assert.equal(card.rTime, receipt.scores.r_time)
    assert.equal(card.rMemory, receipt.scores.r_memory)
    for (const name of ["latency", "memory", "balanced"]) {
      const signed = receipt.scores.tracks[name]
      const shown = card.tracks[name]
      assert.equal(shown.eligible, signed.eligible)
      assert.equal(shown.score, signed.score)
      assert.equal(shown.promotableAgainstBaseline, signed.promotable_against_baseline)
      if (card.promotedTracks.includes(name)) assert.equal(signed.promotable_against_baseline, true)
    }
    assert.deepEqual(
      card.perCase,
      receipt.scores.public_per_case.map((item) => ({
        caseId: item.id,
        timeRatio: item.time_ratio,
        memoryRatio: item.memory_ratio,
      })),
    )
  }
}

console.log(`Verified ${cards.length} signed rank receipts`)
