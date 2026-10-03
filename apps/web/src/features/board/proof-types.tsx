"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useState } from "react"

import type { Challenge } from "@/data/schema"
import { formatSeconds } from "@/lib/format"

type ProofTypeId = "cairo" | "wrap" | "fold" | "pipeline"

interface ProofType {
  id: ProofTypeId
  name: string
  explainer: string
  inputs: string
  facts: { label: string; value: string }[]
}

const range = (values: readonly number[], format: (value: number) => string) =>
  values.length === 0
    ? "—"
    : Math.min(...values) === Math.max(...values)
      ? format(Math.min(...values))
      : `${format(Math.min(...values))}–${format(Math.max(...values))}`

/** Every fact is derived from the challenge's fixture and baselines. */
function proofTypes(challenge: Challenge): ProofType[] {
  const { cases, stages, families } = challenge
  const pies = cases.filter((testCase) => testCase.family === "pie")
  const folds = cases.filter((testCase) => testCase.family === "recursion")
  const pipelines = cases.filter((testCase) => testCase.family === "pipeline")
  const blocks = pies.flatMap((testCase) =>
    testCase.blocks ? [testCase.blocks[1] - testCase.blocks[0] + 1] : [],
  )
  const steps = pies.flatMap((testCase) =>
    testCase.osSteps === undefined ? [] : [testCase.osSteps],
  )
  const baselineOf = (list: typeof cases) =>
    range(
      list.flatMap((testCase) =>
        testCase.baseline.proofTimeS === null ? [] : [testCase.baseline.proofTimeS],
      ),
      formatSeconds,
    )
  const leafCount = (list: typeof cases) => list.map((testCase) => testCase.leaves ?? 2)
  const stage = (id: "cairo" | "wrap" | "fold") => stages.find((item) => item.id === id)
  const pipelineFamily = families.find((family) => family.id === "pipeline")

  const out: ProofType[] = []
  const cairo = stage("cairo")
  if (cairo)
    out.push({
      id: "cairo",
      name: cairo.name,
      explainer: cairo.explainer,
      inputs: cairo.inputs,
      facts: [
        { label: "Standalone Cairo jobs", value: formatNumber(pies.length) },
        { label: "Blocks per PIE", value: range(blocks, (value) => formatNumber(value)) },
        {
          label: "Cairo OS steps",
          value: range(steps, (value) => `${formatNumber(value / 1e6, 1)}M`),
        },
        { label: "Baseline on this host", value: baselineOf(pies) },
      ],
    })
  const wrap = stage("wrap")
  if (wrap)
    out.push({
      id: "wrap",
      name: wrap.name,
      explainer: wrap.explainer,
      inputs: wrap.inputs,
      facts: [
        {
          label: "Wraps per pipeline job",
          value: range(leafCount(pipelines), (value) => formatNumber(value)),
        },
        { label: "Proof count", value: "one per Cairo proof" },
      ],
    })
  const fold = stage("fold")
  if (fold)
    out.push({
      id: "fold",
      name: fold.name,
      explainer: fold.explainer,
      inputs: fold.inputs,
      facts: [
        { label: "Fold jobs", value: formatNumber(folds.length) },
        {
          label: "Folds per job",
          value: range(
            leafCount(folds).map((leaves) => leaves - 1),
            (value) => formatNumber(value),
          ),
        },
        {
          label: "Leaves per tree",
          value: range(leafCount(folds), (value) => formatNumber(value)),
        },
        { label: "Baseline on this host", value: baselineOf(folds) },
      ],
    })
  if (pipelineFamily?.explainer !== undefined && pipelineFamily.inputs !== undefined)
    out.push({
      id: "pipeline",
      name: pipelineFamily.name,
      explainer: pipelineFamily.explainer,
      inputs: pipelineFamily.inputs,
      facts: [
        { label: "Pipeline jobs", value: formatNumber(pipelines.length) },
        {
          label: "Proofs per job",
          value: range(
            leafCount(pipelines).map((leaves) => leaves * 2 + leaves - 1),
            (value) => formatNumber(value),
          ),
        },
        { label: "Baseline on this host", value: baselineOf(pipelines) },
      ],
    })
  return out
}

/* --------------------------------------------------------------------------------------------
 * Diagrams: small looping SVG stories in the site's quiet palette. Static under reduced motion.
 * ------------------------------------------------------------------------------------------ */

const CYCLE = 4.8

function useLoop() {
  const reduce = useReducedMotion() === true
  return (delay: number, duration = 0.6) =>
    reduce
      ? { duration: 0 }
      : {
          duration,
          delay,
          repeat: Infinity,
          repeatDelay: CYCLE - duration,
          ease: [0.16, 1, 0.3, 1] as const,
        }
}

const label = "fill-fg-faint font-mono text-[10px]"

function Proof({ x, y, accent = true }: { x: number; y: number; accent?: boolean }) {
  return (
    <g transform={`translate(${String(x)},${String(y)})`}>
      <rect
        x={-18}
        y={-18}
        width={36}
        height={36}
        rx={10}
        fill={accent ? "var(--ar-accent-soft)" : "var(--ar-surface)"}
        stroke={accent ? "var(--ar-accent)" : "var(--ar-line-strong)"}
        strokeWidth={1.25}
      />
      <text
        textAnchor="middle"
        dy="0.36em"
        className={
          accent
            ? "fill-accent font-display text-[18px] italic"
            : "fill-fg-muted font-display text-[18px] italic"
        }
      >
        π
      </text>
    </g>
  )
}

function CairoDiagram() {
  const loop = useLoop()
  const rows = 6
  const cols = 10
  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="Blocks become an execution trace, then a Cairo proof"
    >
      {/* Blocks inside the PIE */}
      <g>
        {[0, 1, 2].map((index) => (
          <motion.rect
            key={index}
            x={24}
            y={70 + index * 34}
            width={60}
            height={26}
            rx={6}
            fill="var(--ar-surface)"
            stroke="var(--ar-line-strong)"
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 1, 1] }}
            transition={loop(index * 0.15)}
          />
        ))}
        <text x={54} y={60} textAnchor="middle" className={label}>
          PIE · blocks
        </text>
      </g>
      {/* Execution trace filling row by row */}
      <g transform="translate(118,62)">
        {Array.from({ length: rows * cols }, (_, index) => {
          const row = Math.floor(index / cols)
          const col = index % cols
          return (
            <motion.rect
              key={index}
              x={col * 13}
              y={row * 18}
              width={10}
              height={14}
              rx={2}
              fill="var(--ar-accent)"
              initial={{ opacity: 0.08 }}
              animate={{ opacity: [0.08, 0.75, 0.25] }}
              transition={loop(0.6 + row * 0.18 + col * 0.02, 0.9)}
            />
          )
        })}
        <text x={64} y={-8} textAnchor="middle" className={label}>
          execution trace
        </text>
      </g>
      {/* Commitment then proof */}
      <motion.path
        d="M258 115 C 285 115, 290 120, 318 120"
        fill="none"
        stroke="var(--ar-line-strong)"
        strokeWidth={1.25}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1] }}
        transition={loop(2, 0.8)}
      />
      <motion.g
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1, 1], opacity: [0, 1, 1] }}
        transition={loop(2.6, 0.6)}
        style={{ transformOrigin: "345px 120px" }}
      >
        <Proof x={345} y={120} />
      </motion.g>
      <text x={345} y={160} textAnchor="middle" className={label}>
        Cairo proof
      </text>
    </svg>
  )
}

function WrapDiagram() {
  const loop = useLoop()
  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="A Cairo proof is verified inside a circuit, producing a leaf"
    >
      <Proof x={70} y={120} accent={false} />
      <text x={70} y={160} textAnchor="middle" className={label}>
        Cairo proof
      </text>
      <motion.g initial={{ x: 0 }} animate={{ x: [0, 108, 108] }} transition={loop(0.4, 1)}>
        <circle cx={70} cy={120} r={3} fill="var(--ar-fg-muted)" />
      </motion.g>
      {/* Verifier circuit */}
      <motion.rect
        x={140}
        y={68}
        width={120}
        height={104}
        rx={14}
        fill="none"
        stroke="var(--ar-line-strong)"
        strokeDasharray="5 5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1] }}
        transition={loop(0.2, 1.2)}
      />
      {[0, 1, 2].map((index) => (
        <motion.line
          key={index}
          x1={156}
          x2={244}
          y1={96 + index * 24}
          y2={96 + index * 24}
          stroke="var(--ar-accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0.2 }}
          animate={{ pathLength: [0, 1, 1], opacity: [0.2, 0.9, 0.4] }}
          transition={loop(1.3 + index * 0.25, 0.7)}
        />
      ))}
      <text x={200} y={58} textAnchor="middle" className={label}>
        verifier circuit
      </text>
      <motion.g
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1, 1], opacity: [0, 1, 1] }}
        transition={loop(2.6, 0.6)}
        style={{ transformOrigin: "330px 120px" }}
      >
        <Proof x={330} y={120} />
      </motion.g>
      <text x={330} y={160} textAnchor="middle" className={label}>
        circuit leaf
      </text>
    </svg>
  )
}

function FoldDiagram() {
  const loop = useLoop()
  // Eight leaves fold pairwise into one root: levels of 8 → 4 → 2 → 1.
  const levels = [8, 4, 2, 1]
  const y = (level: number) => 196 - level * 52
  const x = (level: number, index: number) => {
    const count = levels[level] ?? 1
    return 40 + ((index + 0.5) * 320) / count
  }
  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="Pairs of proofs fold into parents until one root remains"
    >
      {levels.slice(1).map((count, levelIndex) => {
        const level = levelIndex + 1
        return Array.from({ length: count }, (_, index) => (
          <g key={`${String(level)}-${String(index)}`}>
            {[0, 1].map((child) => (
              <motion.line
                key={child}
                x1={x(level - 1, index * 2 + child)}
                y1={y(level - 1) - 8}
                x2={x(level, index)}
                y2={y(level) + 8}
                stroke="var(--ar-line-strong)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 1] }}
                transition={loop(level * 0.7, 0.5)}
              />
            ))}
          </g>
        ))
      })}
      {levels.map((count, level) =>
        Array.from({ length: count }, (_, index) => (
          <motion.circle
            key={`${String(level)}-${String(index)}`}
            cx={x(level, index)}
            cy={y(level)}
            r={level === levels.length - 1 ? 11 : 7}
            fill={level === levels.length - 1 ? "var(--ar-accent)" : "var(--ar-surface)"}
            stroke={level === 0 ? "var(--ar-line-strong)" : "var(--ar-accent)"}
            strokeWidth={1.25}
            initial={{ opacity: level === 0 ? 1 : 0, scale: level === 0 ? 1 : 0.4 }}
            animate={level === 0 ? { opacity: 1 } : { opacity: [0, 1, 1], scale: [0.4, 1, 1] }}
            transition={level === 0 ? { duration: 0 } : loop(level * 0.7 + 0.4, 0.5)}
            style={{ transformOrigin: `${String(x(level, index))}px ${String(y(level))}px` }}
          />
        )),
      )}
      <text x={20} y={y(0) + 4} className={label}>
        leaves
      </text>
      <text x={x(3, 0) + 18} y={y(3) + 4} className={label}>
        root
      </text>
    </svg>
  )
}

function PipelineDiagram() {
  const loop = useLoop()
  const rows = [80, 160]
  const stepsX = [40, 130, 220]
  return (
    <svg
      viewBox="0 0 400 240"
      className="h-full w-full"
      role="img"
      aria-label="Two PIEs are proved, wrapped and folded into one root"
    >
      {rows.map((rowY, row) => (
        <g key={rowY}>
          <motion.rect
            x={stepsX[0] ?? 0}
            y={rowY - 13}
            width={44}
            height={26}
            rx={6}
            fill="var(--ar-surface)"
            stroke="var(--ar-line-strong)"
            initial={{ opacity: 0.4 }}
            animate={{ opacity: [0.4, 1, 1] }}
            transition={loop(row * 0.2)}
          />
          <text x={(stepsX[0] ?? 0) + 22} y={rowY + 4} textAnchor="middle" className={label}>
            PIE
          </text>
          {[1, 2].map((step) => (
            <g key={step}>
              <motion.line
                x1={(stepsX[step - 1] ?? 0) + (step === 1 ? 48 : 22)}
                x2={(stepsX[step] ?? 0) - 22}
                y1={rowY}
                y2={rowY}
                stroke="var(--ar-line-strong)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: [0, 1, 1] }}
                transition={loop(0.4 + step * 0.7 + row * 0.15, 0.5)}
              />
              <motion.g
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: [0, 1, 1], scale: [0.6, 1, 1] }}
                transition={loop(0.8 + step * 0.7 + row * 0.15, 0.5)}
                style={{ transformOrigin: `${String(stepsX[step] ?? 0)}px ${String(rowY)}px` }}
              >
                <Proof x={stepsX[step] ?? 0} y={rowY} accent={step === 2} />
              </motion.g>
            </g>
          ))}
        </g>
      ))}
      <text x={stepsX[1]} y={44} textAnchor="middle" className={label}>
        Cairo
      </text>
      <text x={stepsX[2]} y={44} textAnchor="middle" className={label}>
        wrap
      </text>
      {rows.map((rowY) => (
        <motion.line
          key={rowY}
          x1={(stepsX[2] ?? 0) + 22}
          y1={rowY}
          x2={318}
          y2={120}
          stroke="var(--ar-accent)"
          strokeWidth={1.25}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: [0, 1, 1] }}
          transition={loop(2.5, 0.5)}
        />
      ))}
      <motion.circle
        cx={340}
        cy={120}
        r={14}
        fill="var(--ar-accent)"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 1], scale: [0.4, 1, 1] }}
        transition={loop(3, 0.5)}
        style={{ transformOrigin: "340px 120px" }}
      />
      <text x={340} y={156} textAnchor="middle" className={label}>
        fold → root
      </text>
    </svg>
  )
}

const DIAGRAMS: Record<ProofTypeId, () => React.JSX.Element> = {
  cairo: CairoDiagram,
  wrap: WrapDiagram,
  fold: FoldDiagram,
  pipeline: PipelineDiagram,
}

/**
 * What is being proved: one proof type at a time, an animated diagram on the left and an
 * equal-height explanation on the right, including what goes into the proof.
 */
export function ProofTypes({ challenge }: { challenge: Challenge }) {
  const types = proofTypes(challenge)
  const [active, setActive] = useState<ProofTypeId>(types[0]?.id ?? "cairo")
  const current = types.find((type) => type.id === active) ?? types[0]
  if (current === undefined) return null
  const Diagram = DIAGRAMS[current.id]

  return (
    <div className="space-y-5">
      <SegmentedControl
        aria-label="Proof type"
        size="sm"
        value={current.id}
        onValueChange={setActive}
        options={types.map((type) => ({ value: type.id, label: type.name }))}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="relative flex min-h-[22rem] items-center justify-center overflow-hidden rounded-2xl border border-line bg-bg-raised p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="h-full w-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <Diagram />
            </motion.div>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait">
          <motion.article
            key={current.id}
            className="flex min-h-[22rem] flex-col rounded-2xl border border-line p-6 sm:p-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 className="text-2xl font-normal tracking-tight">{current.name}</h3>
            <p className="mt-3 leading-relaxed text-fg-muted">{current.explainer}</p>
            <p className="mt-6 text-label">Inputs</p>
            <p className="mt-1 text-sm leading-relaxed text-fg-muted">{current.inputs}</p>
            <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5">
              {current.facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-label">{fact.label}</dt>
                  <dd className="mt-1 font-mono text-sm tabular">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </motion.article>
        </AnimatePresence>
      </div>
    </div>
  )
}
