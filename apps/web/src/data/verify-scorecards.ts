import { createHash, createPublicKey, verify } from "node:crypto"

import { z } from "zod"

import { contractImportedSchema, scorecardSchema, type Scorecard } from "./schema"

const signatureSchema = z.object({
  schema: z.literal("stwo-cuda-receipt-signature-v1"),
  algorithm: z.literal("Ed25519"),
  receipt_sha256: z.string(),
  key_id: z.string(),
  signature_base64: z.string(),
})
const signedTrack = z.object({
  eligible: z.boolean(),
  score: z.number().positive().nullable(),
  promotable_against_baseline: z.boolean(),
})
const receiptSchema = z.object({
  schema: z.literal("stwo-cuda-public-receipt-v1"),
  tier: z.literal("rank"),
  submission_id: z.string(),
  patch_sha256: z.string(),
  repository: z.string(),
  commit_sha: z.string(),
  source_commit: z.string(),
  contract_epoch: z.string(),
  holdout_case_count: z.number().int().positive(),
  scores: z.object({
    r_time: z.number().positive(),
    r_memory: z.number().positive(),
    tracks: z.object({ latency: signedTrack, memory: signedTrack, balanced: signedTrack }),
    public_per_case: z.array(
      z.object({
        id: z.string(),
        time_ratio: z.number().positive(),
        memory_ratio: z.number().positive(),
      }),
    ),
  }),
})

/** Verify each displayed ranked number against a judge-signed receipt. */
export async function verifyScorecards(
  rawCards: unknown,
  rawContract: unknown,
  publicCaseIds: readonly string[],
  readArtifact: (path: string) => Promise<Uint8Array>,
): Promise<readonly Scorecard[]> {
  const cards = scorecardSchema.array().parse(rawCards)
  if (cards.length === 0) return cards
  const contract = contractImportedSchema.parse(rawContract)
  const publicKey = createPublicKey(
    Buffer.from(await readArtifact("data/site/operator-public.pem")),
  )
  const keyId = createHash("sha256")
    .update(publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
  const expectedCases = new Set(publicCaseIds)
  const seen = new Set<string>()
  for (const card of cards) {
    if (seen.has(card.id)) throw new Error(`Duplicate signed scorecard: ${card.id}`)
    seen.add(card.id)
    const prefix = `data/site/receipts/${card.receiptSha256}`
    const [raw, rawSignature] = await Promise.all([
      readArtifact(`${prefix}.json`),
      readArtifact(`${prefix}.signature.json`),
    ])
    const digest = createHash("sha256").update(raw).digest("hex")
    if (digest !== card.receiptSha256) throw new Error("Signed receipt digest differs")
    const envelope = signatureSchema.parse(JSON.parse(Buffer.from(rawSignature).toString("utf8")))
    if (
      envelope.receipt_sha256 !== digest ||
      envelope.key_id !== keyId ||
      card.receiptKeyId !== keyId
    )
      throw new Error("Signed receipt key or digest differs")
    const signature = Buffer.from(envelope.signature_base64, "base64")
    if (signature.length !== 64 || !verify(null, raw, publicKey, signature))
      throw new Error("Signed receipt signature is invalid")
    const receipt = receiptSchema.parse(JSON.parse(Buffer.from(raw).toString("utf8")))
    if (
      receipt.submission_id !== card.id ||
      receipt.patch_sha256 !== card.patchSha256 ||
      receipt.repository !== card.repositoryUrl ||
      receipt.commit_sha !== card.commit ||
      receipt.source_commit !== contract.sourceCommit ||
      receipt.contract_epoch !== contract.contractEpoch ||
      receipt.scores.r_time !== card.rTime ||
      receipt.scores.r_memory !== card.rMemory
    )
      throw new Error("Scorecard differs from signed receipt or active contract")
    for (const track of ["latency", "memory", "balanced"] as const) {
      const signed = receipt.scores.tracks[track]
      const shown = card.tracks[track]
      if (
        shown.eligible !== signed.eligible ||
        shown.score !== signed.score ||
        shown.promotableAgainstBaseline !== signed.promotable_against_baseline ||
        (card.promotedTracks.includes(track) && !signed.promotable_against_baseline)
      )
        throw new Error(`Scorecard ${track} differs from signed receipt`)
    }
    const signedCases = receipt.scores.public_per_case
    if (
      signedCases.length !== expectedCases.size ||
      new Set(signedCases.map((item) => item.id)).size !== expectedCases.size ||
      signedCases.some((item) => !expectedCases.has(item.id)) ||
      card.perCase.length !== signedCases.length ||
      card.perCase.some((item, index) => {
        const signed = signedCases[index]
        return (
          item.caseId !== signed?.id ||
          item.timeRatio !== signed.time_ratio ||
          item.memoryRatio !== signed.memory_ratio
        )
      })
    )
      throw new Error("Scorecard public cases differ from signed receipt")
  }
  return cards
}
