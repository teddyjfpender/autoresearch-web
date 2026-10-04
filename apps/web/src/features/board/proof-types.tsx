"use client"

import { SegmentedControl } from "@autoresearch/ui/components/segmented-control"
import { formatNumber } from "@autoresearch/ui/lib/format"
import { cn } from "@autoresearch/ui/lib/cn"
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState, type SVGProps } from "react"

import type { Challenge } from "@/data/schema"
import { formatSeconds } from "@/lib/format"

type SceneId = "cairo" | "wrap" | "fold" | "pipeline" | "guest"

/** What a full-guest scene draws for one target, from the pinned suite. */
interface GuestShape {
  /** Largest pinned input's execution cycles. */
  cycles: number
  /** Short input label, e.g. "2 KiB" or "16 × M31". */
  input: string
  /** Whether the guest calls a proved precompile (ECDSA). */
  precompile: boolean
}

interface ProofType {
  id: string
  scene: SceneId
  guest?: GuestShape
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
  return challenge.kind === "riscv-csp" ? guestTypes(challenge) : stwoTypes(challenge)
}

const UNIT: Record<string, (size: number) => string> = {
  bytes: (size) => (size >= 1024 ? `${formatNumber(size / 1024)} KiB` : `${formatNumber(size)} B`),
  field_elements: (size) => `${formatNumber(size)} × M31`,
}

/** RISC-V CSP: one full-guest proof type per target, shaped by the pinned suite. */
function guestTypes(challenge: Challenge): ProofType[] {
  const precompile = (id: string) => id.startsWith("ecdsa")
  return challenge.families.map((family) => {
    const cases = challenge.cases.filter((testCase) => testCase.family === family.id)
    const sizes = cases.flatMap((testCase) =>
      testCase.inputSize === undefined ? [] : [testCase.inputSize],
    )
    const cycles = cases.flatMap((testCase) =>
      testCase.cycles === undefined ? [] : [testCase.cycles],
    )
    const unit = cases[0]?.inputUnit ?? ""
    const sizeLabel = (size: number) =>
      precompile(family.id) ? "signature" : (UNIT[unit] ?? ((value) => formatNumber(value)))(size)
    const measured = cases.flatMap((testCase) =>
      testCase.baseline.proofTimeS === null ? [] : [testCase.baseline.proofTimeS],
    )
    return {
      id: family.id,
      scene: "guest" as const,
      guest: {
        cycles: cycles.length === 0 ? 0 : Math.max(...cycles),
        input: sizes.length === 0 ? "input" : sizeLabel(Math.max(...sizes)),
        precompile: precompile(family.id),
      },
      name: family.name,
      explainer: family.explainer ?? family.description,
      inputs: family.inputs ?? "",
      facts: [
        { label: "Cases", value: formatNumber(cases.length) },
        {
          label: precompile(family.id) ? "Input" : "Input sizes",
          value: precompile(family.id) ? "digest · key · signature" : range(sizes, sizeLabel),
        },
        {
          label: "Guest cycles",
          value: range(cycles, (value) => formatNumber(value)),
        },
        {
          label: "Baseline on this host",
          value: measured.length === 0 ? "Pending" : range(measured, formatSeconds),
        },
      ],
    }
  })
}

function stwoTypes(challenge: Challenge): ProofType[] {
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
      scene: "cairo",
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
      scene: "wrap",
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
      scene: "fold",
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
      scene: "pipeline",
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
 * Diagrams: each proof type is a short, stepped story on one shared clock. A step rail below
 * the scene names the step in play and can be clicked to jump. Under reduced motion every
 * scene renders in its finished state with no looping.
 * ------------------------------------------------------------------------------------------ */

const EASE = [0.16, 1, 0.3, 1] as const
const STEP_MS = 1800
const HOLD_MS = 2400
const W = 440
const H = 220

type Status = "idle" | "active" | "done"
const statusOf = (phase: number, step: number): Status =>
  phase > step ? "done" : phase === step ? "active" : "idle"
const OVERLAY: Record<Status, number> = { idle: 0, active: 1, done: 0.5 }

/** Shape of the drawn workload, read from the fixture so the diagrams match the basket. */
interface SceneSpec {
  /** Proof system label from the contract, e.g. "BLAKE3 STARK". */
  suite: string
  blocks: number
  foldLeaves: number
  pipelineLeaves: number
}

const powerOfTwo = (value: number) => 2 ** Math.max(1, Math.min(3, Math.round(Math.log2(value))))

function sceneSpec(challenge: Challenge): SceneSpec {
  const leaves = (family: string) =>
    Math.max(
      2,
      ...challenge.cases.flatMap((testCase) =>
        testCase.family === family && testCase.leaves !== undefined ? [testCase.leaves] : [],
      ),
    )
  const blocks = challenge.cases.flatMap((testCase) =>
    testCase.blocks ? [testCase.blocks[1] - testCase.blocks[0] + 1] : [],
  )
  const { security } = challenge.contract
  return {
    suite: `${security.preprocessedVariant.toUpperCase()} STARK`,
    blocks: Math.max(1, Math.min(4, ...(blocks.length === 0 ? [3] : [Math.max(...blocks)]))),
    foldLeaves: powerOfTwo(leaves("recursion")),
    pipelineLeaves: Math.min(4, leaves("pipeline")),
  }
}

function useTimeline(count: number) {
  const reduce = useReducedMotion() === true
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.4 })
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (reduce || !inView) return
    const id = window.setTimeout(
      () => {
        setPhase((current) => (current + 1) % (count + 1))
      },
      phase >= count ? HOLD_MS : STEP_MS,
    )
    return () => {
      window.clearTimeout(id)
    }
  }, [phase, inView, reduce, count])
  return { ref, phase: reduce ? count : phase, setPhase, reduce }
}

const caption = (status: Status) =>
  cn(
    "font-mono text-[10px] transition-[fill] duration-500",
    status === "active" ? "fill-fg" : status === "done" ? "fill-fg-muted" : "fill-fg-faint",
  )

/** A connection that draws in when its step starts and carries a moving dash while active. */
function Flow({ d, status }: { d: string; status: Status }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} stroke="var(--ar-line-strong)" strokeWidth={1.25} />
      <motion.path
        d={d}
        stroke="var(--ar-accent)"
        strokeWidth={1.25}
        initial={false}
        animate={{ pathLength: status === "idle" ? 0 : 1, opacity: OVERLAY[status] }}
        transition={{ duration: 0.7, ease: EASE }}
      />
      {status === "active" ? (
        <motion.path
          d={d}
          stroke="var(--ar-accent)"
          strokeWidth={2.25}
          strokeDasharray="1.5 9"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -21 }}
          transition={{ duration: 0.7, ease: "linear", repeat: Infinity }}
        />
      ) : null}
    </g>
  )
}

/** A bordered region that lights up while its step runs. */
function Region({
  x,
  y,
  w,
  h,
  r = 10,
  status,
}: {
  x: number
  y: number
  w: number
  h: number
  r?: number
  status: Status
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="var(--ar-bg)"
        stroke="var(--ar-line-strong)"
      />
      <motion.rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill="var(--ar-accent-soft)"
        stroke="var(--ar-accent)"
        strokeWidth={1.25}
        initial={false}
        animate={{ opacity: OVERLAY[status] }}
        transition={{ duration: 0.5, ease: EASE }}
      />
    </g>
  )
}

/**
 * A proof. STARK proofs (Cairo AIR) are squares; circuit proofs (wraps, folds) are circles,
 * so the change of proof system reads at a glance. Pending outputs show as a dashed ghost.
 */
function Glyph({
  x,
  y,
  kind,
  status,
  size = 17,
  symbol = kind === "stark" ? "π" : "π′",
}: {
  x: number
  y: number
  kind: "stark" | "circuit"
  status: Status
  size?: number
  symbol?: string
}) {
  const shape = (props: SVGProps<SVGRectElement> & SVGProps<SVGCircleElement>) =>
    kind === "stark" ? (
      <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={size * 0.45} {...props} />
    ) : (
      <circle r={size} {...props} />
    )
  const produced = status !== "idle"
  return (
    <g transform={`translate(${String(x)},${String(y)})`}>
      {shape({ fill: "none", stroke: "var(--ar-line-strong)", strokeDasharray: "3 4" })}
      {status === "active" ? (
        <motion.g
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 1.7 }}
          transition={{ duration: 1.3, ease: "easeOut", repeat: Infinity }}
        >
          {shape({ fill: "none", stroke: "var(--ar-accent)", strokeWidth: 1 })}
        </motion.g>
      ) : null}
      <motion.g
        initial={false}
        animate={{ opacity: produced ? 1 : 0, scale: produced ? 1 : 0.55 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        {shape({ fill: "var(--ar-bg)", stroke: "var(--ar-accent)", strokeWidth: 1.25 })}
        {shape({ fill: "var(--ar-accent-soft)" })}
        <text
          textAnchor="middle"
          dy="0.34em"
          className="fill-accent font-display italic"
          style={{ fontSize: size * 1.05 }}
        >
          {symbol}
        </text>
      </motion.g>
    </g>
  )
}

/* Cairo: execute the PIE into an AIR trace, commit to it, run FRI, emit the proof. */
const CAIRO_STEPS = ["Execute", "Commit", "FRI", "Proof"] as const

function CairoScene({ phase, spec }: { phase: number; spec: SceneSpec }) {
  const [execute, commit, fri, proof] = [0, 1, 2, 3].map((step) => statusOf(phase, step)) as [
    Status,
    Status,
    Status,
    Status,
  ]
  const cols = 8
  const rows = 12
  const chipGap = 6
  const chipH = (96 - (spec.blocks - 1) * chipGap) / spec.blocks
  const leaves = [236, 252, 268, 284]
  const mid = [244, 276]
  const bars = [72, 40, 22, 12]
  return (
    <>
      {/* PIE with its blocks */}
      <Region x={14} y={58} w={72} h={108} status={execute} />
      {Array.from({ length: spec.blocks }, (_, index) => (
        <g key={index}>
          <rect
            x={24}
            y={64 + index * (chipH + chipGap)}
            width={52}
            height={chipH}
            rx={4}
            fill="var(--ar-surface)"
          />
          <motion.rect
            x={24}
            y={64 + index * (chipH + chipGap)}
            width={52}
            height={chipH}
            rx={4}
            fill="var(--ar-accent)"
            initial={false}
            animate={{
              opacity: execute === "active" ? [0, 0.55, 0.15] : execute === "done" ? 0.15 : 0,
            }}
            transition={{ duration: 0.9, delay: index * 0.25, ease: EASE }}
          />
          <text
            x={50}
            y={64 + index * (chipH + chipGap) + chipH / 2}
            dy="0.34em"
            textAnchor="middle"
            className="fill-fg-muted font-mono text-[9px]"
          >
            block {index + 1}
          </text>
        </g>
      ))}
      <Flow d="M86,112 H108" status={execute} />
      {/* AIR trace, filled row by row as the OS executes */}
      {Array.from({ length: rows * cols }, (_, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        return (
          <motion.rect
            key={index}
            x={112 + col * 11.5}
            y={58 + row * 9}
            width={9}
            height={6.5}
            rx={1.5}
            fill="var(--ar-accent)"
            initial={false}
            animate={{
              opacity:
                execute === "idle"
                  ? 0.07
                  : execute === "active"
                    ? 0.75
                    : commit === "active"
                      ? 0.5
                      : 0.3,
            }}
            transition={{
              duration: 0.35,
              delay: execute === "active" ? (row / rows) * (STEP_MS / 1000) * 0.8 + col * 0.01 : 0,
            }}
          />
        )
      })}
      <Flow d="M206,112 H226" status={commit} />
      {/* Merkle commitment over the trace columns */}
      {mid.flatMap((parent, index) =>
        [leaves[index * 2] ?? 0, leaves[index * 2 + 1] ?? 0].map((leaf) => (
          <Flow
            key={`${String(parent)}-${String(leaf)}`}
            d={`M${String(leaf)},146 L${String(parent)},116`}
            status={commit}
          />
        )),
      )}
      {mid.map((parent) => (
        <Flow key={parent} d={`M${String(parent)},108 L260,82`} status={commit} />
      ))}
      {leaves.map((leaf) => (
        <rect
          key={leaf}
          x={leaf - 4}
          y={146}
          width={8}
          height={8}
          rx={2}
          fill="var(--ar-fg-faint)"
        />
      ))}
      {mid.map((parent) => (
        <circle key={parent} cx={parent} cy={112} r={4} fill="var(--ar-fg-faint)" />
      ))}
      <motion.circle
        cx={260}
        cy={78}
        r={6}
        fill="var(--ar-accent)"
        initial={false}
        animate={{
          opacity: commit === "idle" ? 0.15 : 1,
          scale: commit === "active" ? [1, 1.35, 1] : 1,
        }}
        transition={{ duration: 0.8, delay: commit === "active" ? 0.6 : 0, ease: EASE }}
      />
      <Flow d="M296,112 H306" status={fri} />
      {/* FRI: each round halves the polynomial's degree */}
      {bars.map((height, index) => (
        <g key={height}>
          <rect
            x={312 + index * 13}
            y={154 - 72}
            width={8}
            height={72}
            rx={2}
            fill="var(--ar-surface)"
          />
          <motion.rect
            x={312 + index * 13}
            y={154 - height}
            width={8}
            height={height}
            rx={2}
            fill="var(--ar-accent)"
            initial={false}
            animate={{
              opacity: fri === "idle" ? 0 : fri === "active" ? 0.85 : 0.45,
              scaleY: fri === "idle" ? 0 : 1,
            }}
            transition={{ duration: 0.45, delay: fri === "active" ? index * 0.32 : 0, ease: EASE }}
            style={{ originY: 1 }}
          />
        </g>
      ))}
      <Flow d="M366,112 H386" status={proof} />
      <Glyph x={410} y={112} kind="stark" status={proof} size={17} />
      {/* Column captions */}
      {(
        [
          [50, "PIE", execute],
          [157, "AIR trace", execute],
          [260, "commit", commit],
          [331, "FRI", fri],
          [410, "proof", proof],
        ] as const
      ).map(([x, text, status]) => (
        <text key={text} x={x} y={40} textAnchor="middle" className={caption(status)}>
          {text}
        </text>
      ))}
      {(
        [
          [50, `${String(spec.blocks)} block${spec.blocks === 1 ? "" : "s"}`],
          [157, "rows × columns"],
          [260, "Merkle root"],
          [331, "degree ÷ 2"],
          [410, "Cairo proof"],
        ] as const
      ).map(([x, text]) => (
        <text
          key={text}
          x={x}
          y={190}
          textAnchor="middle"
          className="fill-fg-faint font-mono text-[9px]"
        >
          {text}
        </text>
      ))}
    </>
  )
}

/* Wrap: verify a Cairo proof inside a circuit, prove that circuit, emit a leaf. */
const WRAP_STEPS = ["Input", "Verify", "Prove", "Leaf"] as const
const CHECKS = ["Merkle paths", "FRI queries", "AIR constraints"] as const

function WrapScene({ phase }: { phase: number }) {
  const [input, verify, prove, leaf] = [0, 1, 2, 3].map((step) => statusOf(phase, step)) as [
    Status,
    Status,
    Status,
    Status,
  ]
  return (
    <>
      <Glyph x={50} y={112} kind="stark" status={input === "active" ? "active" : "done"} />
      <Flow d="M72,112 H118" status={input} />
      <Region x={122} y={50} w={196} h={124} r={14} status={prove} />
      <clipPath id="wrap-circuit">
        <rect x={122} y={50} width={196} height={124} rx={14} />
      </clipPath>
      {prove === "active" ? (
        <motion.rect
          y={50}
          width={40}
          height={124}
          fill="url(#wrap-sweep)"
          clipPath="url(#wrap-circuit)"
          initial={{ x: 82 }}
          animate={{ x: 318 }}
          transition={{ duration: 0.9, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.1 }}
        />
      ) : null}
      <defs>
        <linearGradient id="wrap-sweep" x1="0" x2="1">
          <stop offset="0" stopColor="var(--ar-accent)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--ar-accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--ar-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {CHECKS.map((check, index) => {
        const y = 88 + index * 28
        return (
          <g key={check}>
            <text
              x={136}
              y={y}
              dy="0.34em"
              className={caption(verify === "idle" ? "idle" : "done")}
            >
              {check}
            </text>
            <line
              x1={238}
              x2={286}
              y1={y}
              y2={y}
              stroke="var(--ar-line-strong)"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <motion.line
              x1={238}
              x2={286}
              y1={y}
              y2={y}
              stroke="var(--ar-accent)"
              strokeWidth={2}
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: verify === "idle" ? 0 : 1 }}
              transition={{
                duration: 0.45,
                delay: verify === "active" ? index * 0.45 : 0,
                ease: EASE,
              }}
            />
            <motion.path
              d={`M295,${String(y)} l3.5,3.5 l6,-7`}
              fill="none"
              stroke="var(--ar-accent)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{
                pathLength: verify === "idle" ? 0 : 1,
                opacity: verify === "idle" ? 0 : 1,
              }}
              transition={{ duration: 0.3, delay: verify === "active" ? index * 0.45 + 0.4 : 0 }}
            />
          </g>
        )
      })}
      <Flow d="M318,112 H366" status={leaf} />
      <Glyph x={390} y={112} kind="circuit" status={leaf} />
      {(
        [
          [50, "Cairo proof", input],
          [220, "verifier circuit", prove === "idle" ? verify : prove],
          [390, "circuit leaf", leaf],
        ] as const
      ).map(([x, text, status]) => (
        <text key={text} x={x} y={36} textAnchor="middle" className={caption(status)}>
          {text}
        </text>
      ))}
      {(
        [
          [50, "STARK · Cairo AIR"],
          [220, "proved as a circuit"],
          [390, "one per Cairo proof"],
        ] as const
      ).map(([x, text]) => (
        <text
          key={text}
          x={x}
          y={196}
          textAnchor="middle"
          className="fill-fg-faint font-mono text-[9px]"
        >
          {text}
        </text>
      ))}
    </>
  )
}

/* Fold: each fold verifies two child proofs and proves one parent, level by level. */
const foldLevels = (leaves: number) => {
  const levels = [leaves]
  while ((levels.at(-1) ?? 1) > 1) levels.push(Math.ceil((levels.at(-1) ?? 1) / 2))
  return levels
}
const foldSteps = (spec: SceneSpec) =>
  foldLevels(spec.foldLeaves).map((count, level) =>
    level === 0 ? "Leaves" : count === 1 ? "Root" : `Fold ${String(level)}`,
  )

function FoldScene({ phase, spec }: { phase: number; spec: SceneSpec }) {
  const levels = foldLevels(spec.foldLeaves)
  const top = 44
  const bottom = 178
  const y = (level: number) =>
    levels.length === 1 ? bottom : bottom - (level * (bottom - top)) / (levels.length - 1)
  const x = (level: number, index: number) => {
    const count = levels[level] ?? 1
    return 96 + ((index + 0.5) * 320) / count
  }
  const radius = (level: number) => (level === levels.length - 1 ? 16 : 12)
  return (
    <>
      {levels.slice(1).map((count, offset) => {
        const level = offset + 1
        return Array.from({ length: count }, (_, index) =>
          [index * 2, index * 2 + 1]
            .filter((child) => child < (levels[level - 1] ?? 0))
            .map((child) => (
              <Flow
                key={`${String(level)}-${String(index)}-${String(child)}`}
                d={`M${String(x(level - 1, child))},${String(y(level - 1) - radius(level - 1))} L${String(x(level, index))},${String(y(level) + radius(level))}`}
                status={statusOf(phase, level)}
              />
            )),
        )
      })}
      {levels.map((count, level) =>
        Array.from({ length: count }, (_, index) => (
          <Glyph
            key={`${String(level)}-${String(index)}`}
            x={x(level, index)}
            y={y(level)}
            kind="circuit"
            size={radius(level)}
            status={level === 0 ? (phase === 0 ? "active" : "done") : statusOf(phase, level)}
          />
        )),
      )}
      {levels.map((count, level) => (
        <text
          key={count}
          x={14}
          y={y(level)}
          dy="0.34em"
          className={caption(
            level === 0 ? (phase === 0 ? "active" : "done") : statusOf(phase, level),
          )}
        >
          {level === 0
            ? `${String(count)} leaves`
            : count === 1
              ? "root"
              : `${String(count)} folds`}
        </text>
      ))}
      <text
        x={W - 14}
        y={bottom + 28}
        textAnchor="end"
        className="fill-fg-faint font-mono text-[9px]"
      >
        each fold: verify 2 → prove 1
      </text>
    </>
  )
}

/* Pipeline: every stage chained, PIEs to Cairo proofs to leaves to one root. */
const PIPELINE_STEPS = ["Cairo", "Wrap", "Fold"] as const

function PipelineScene({ phase, spec }: { phase: number; spec: SceneSpec }) {
  const lanes = spec.pipelineLeaves
  const [cairo, wrap, fold] = [0, 1, 2].map((step) => statusOf(phase, step)) as [
    Status,
    Status,
    Status,
  ]
  const spread = Math.min(72, 124 / Math.max(1, lanes - 1))
  const laneY = (lane: number) => 112 + (lane - (lanes - 1) / 2) * spread
  const total = 3 * lanes - 1
  const made = (phase > 0 ? lanes : 0) + (phase > 1 ? lanes : 0) + (phase > 2 ? lanes - 1 : 0)
  const glyph = lanes > 2 ? 12 : 15
  return (
    <>
      {Array.from({ length: lanes }, (_, lane) => {
        const ly = laneY(lane)
        return (
          <g key={lane}>
            <rect x={18} y={ly - 12} width={52} height={24} rx={6} fill="var(--ar-surface)" />
            <text
              x={44}
              y={ly}
              dy="0.34em"
              textAnchor="middle"
              className="fill-fg-muted font-mono text-[9px]"
            >
              PIE {lane + 1}
            </text>
            <Flow d={`M70,${String(ly)} H${String(146 - glyph)}`} status={cairo} />
            <Glyph x={150} y={ly} kind="stark" size={glyph} status={cairo} />
            <Flow
              d={`M${String(150 + glyph + 4)},${String(ly)} H${String(256 - glyph)}`}
              status={wrap}
            />
            <Glyph x={260} y={ly} kind="circuit" size={glyph} status={wrap} />
            <Flow
              d={`M${String(260 + glyph + 4)},${String(ly)} C ${String(320)},${String(ly)} ${String(320)},112 ${String(366)},112`}
              status={fold}
            />
          </g>
        )
      })}
      <Glyph x={386} y={112} kind="circuit" size={19} status={fold} />
      {(
        [
          [44, "PIE", cairo],
          [150, "Cairo", cairo],
          [260, "wrap", wrap],
          [386, "fold → root", fold],
        ] as const
      ).map(([x, text, status]) => (
        <text key={text} x={x} y={30} textAnchor="middle" className={caption(status)}>
          {text}
        </text>
      ))}
      <text x={W - 14} y={204} textAnchor="end" className="fill-fg-faint font-mono text-[9px]">
        proofs{" "}
        <tspan className="fill-fg">
          {made} / {total}
        </tspan>
      </text>
    </>
  )
}

/* RISC-V guest: execute the guest on its input, build the witness, prove it with Stwo. */
const GUEST_STEPS = ["Execute", "Witness", "Prove"] as const
const INSTRUCTIONS = [
  "lw    a0, 0(s1)",
  "add   a1, a1, a0",
  "srli  t0, a1, 7",
  "xor   a2, a2, t0",
  "slli  t1, a2, 3",
  "and   a3, a3, t1",
  "sw    a3, 4(s1)",
  "bne   s1, s2, -28",
] as const

/** Counts cycles up while execution runs; a static total otherwise. */
function CycleCount({ cycles, status }: { cycles: number; status: Status }) {
  const ref = useRef<SVGTSpanElement>(null)
  const reduce = useReducedMotion() === true
  useEffect(() => {
    const node = ref.current
    if (!node || reduce || status !== "active") return
    const controls = animate(0, cycles, {
      duration: (STEP_MS / 1000) * 0.9,
      ease: "easeOut",
      onUpdate: (value) => {
        node.textContent = formatNumber(Math.round(value))
      },
    })
    return () => {
      controls.stop()
    }
  }, [cycles, status, reduce])
  return (
    <tspan ref={ref} className="fill-fg">
      {status === "idle" ? "0" : formatNumber(cycles)}
    </tspan>
  )
}

function GuestScene({ phase, spec, type }: { phase: number; spec: SceneSpec; type: ProofType }) {
  const [execute, witness, prove] = [0, 1, 2].map((step) => statusOf(phase, step)) as [
    Status,
    Status,
    Status,
  ]
  const guest = type.guest ?? { cycles: 0, input: "input", precompile: false }
  const lineH = 13
  const lines = guest.precompile
    ? [...INSTRUCTIONS.slice(0, 3), "ecall secp256k1", ...INSTRUCTIONS.slice(3)]
    : INSTRUCTIONS
  const cols = 7
  const rows = 11
  return (
    <>
      {/* Inputs: the pinned guest binary and its input */}
      {(
        [
          [64, "guest.elf"],
          [122, guest.input],
        ] as const
      ).map(([y, text]) => (
        <g key={y}>
          <rect x={12} y={y} width={78} height={28} rx={6} fill="var(--ar-surface)" />
          <text
            x={51}
            y={y + 14}
            dy="0.34em"
            textAnchor="middle"
            className="fill-fg-muted font-mono text-[9px]"
          >
            {text}
          </text>
        </g>
      ))}
      <Flow d="M90,78 C 100,78 100,112 112,112" status={execute} />
      <Flow d="M90,136 C 100,136 100,112 112,112" status={execute} />
      {/* The RISC-V CPU running the guest */}
      <Region x={114} y={52} w={112} h={guest.precompile ? 104 : 120} status={execute} />
      <clipPath id="guest-cpu">
        <rect x={114} y={60} width={112} height={guest.precompile ? 90 : 106} />
      </clipPath>
      <motion.g
        clipPath="url(#guest-cpu)"
        initial={false}
        animate={{ y: execute === "active" ? [0, -lineH * lines.length] : 0 }}
        transition={
          execute === "active"
            ? { duration: (STEP_MS / 1000) * 0.9, ease: "linear" }
            : { duration: 0.4, ease: EASE }
        }
      >
        {[...lines, ...lines].map((line, index) => (
          <text
            key={`${line}-${String(index)}`}
            x={124}
            y={70 + index * lineH}
            className={cn(
              "font-mono text-[9px]",
              line.startsWith("ecall") ? "fill-accent" : "fill-fg-muted",
            )}
          >
            {line}
          </text>
        ))}
      </motion.g>
      {guest.precompile ? (
        <g>
          <Flow d="M170,156 V166" status={execute} />
          <Region x={124} y={166} w={92} h={22} r={6} status={execute} />
          <text
            x={170}
            y={177}
            dy="0.34em"
            textAnchor="middle"
            className="fill-fg-muted font-mono text-[9px]"
          >
            ECDSA precompile
          </text>
        </g>
      ) : null}
      <Flow d="M226,112 H246" status={witness} />
      {/* Witness: execution laid out as AIR trace columns */}
      {Array.from({ length: rows * cols }, (_, index) => {
        const row = Math.floor(index / cols)
        const col = index % cols
        return (
          <motion.rect
            key={index}
            x={250 + col * 11}
            y={62 + row * 9.4}
            width={8.5}
            height={6.5}
            rx={1.5}
            fill="var(--ar-accent)"
            initial={false}
            animate={{
              opacity:
                witness === "idle"
                  ? 0.07
                  : witness === "active"
                    ? 0.75
                    : prove === "active"
                      ? 0.5
                      : 0.3,
            }}
            transition={{
              duration: 0.3,
              delay: witness === "active" ? (col / cols) * (STEP_MS / 1000) * 0.75 + row * 0.01 : 0,
            }}
          />
        )
      })}
      <Flow d="M330,112 H382" status={prove} />
      <Glyph x={406} y={112} kind="stark" status={prove} />
      {(
        [
          [51, "input", execute],
          [170, "RISC-V guest", execute],
          [288, "witness", witness],
          [406, "proof", prove],
        ] as const
      ).map(([x, text, status]) => (
        <text key={text} x={x} y={36} textAnchor="middle" className={caption(status)}>
          {text}
        </text>
      ))}
      <text x={170} y={204} textAnchor="middle" className="fill-fg-faint font-mono text-[9px]">
        cycles <CycleCount cycles={guest.cycles} status={execute} />
      </text>
      <text x={288} y={204} textAnchor="middle" className="fill-fg-faint font-mono text-[9px]">
        RISC-V AIR trace
      </text>
      <text x={406} y={204} textAnchor="middle" className="fill-fg-faint font-mono text-[9px]">
        {spec.suite}
      </text>
    </>
  )
}

const SCENES: Record<
  SceneId,
  {
    steps: (spec: SceneSpec) => readonly string[]
    label: string
    Scene: (props: { phase: number; spec: SceneSpec; type: ProofType }) => React.JSX.Element
  }
> = {
  guest: {
    steps: () => GUEST_STEPS,
    label:
      "A RISC-V guest executes on its input, its execution becomes a witness, and Stwo proves it",
    Scene: GuestScene,
  },
  cairo: {
    steps: () => CAIRO_STEPS,
    label:
      "A PIE's blocks execute into an AIR trace, which is committed, tested with FRI and proved",
    Scene: CairoScene,
  },
  wrap: {
    steps: () => WRAP_STEPS,
    label: "A Cairo proof is verified inside a circuit, and that circuit is proved as a leaf",
    Scene: WrapScene,
  },
  fold: {
    steps: foldSteps,
    label: "Pairs of circuit proofs fold into parents until one root remains",
    Scene: FoldScene,
  },
  pipeline: {
    steps: () => PIPELINE_STEPS,
    label: "PIEs are proved, wrapped and folded into one root",
    Scene: PipelineScene,
  },
}

function StepRail({
  steps,
  phase,
  onSelect,
}: {
  steps: readonly string[]
  phase: number
  onSelect: (step: number) => void
}) {
  return (
    <ol
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${String(steps.length)}, minmax(0, 1fr))` }}
    >
      {steps.map((step, index) => {
        const status = statusOf(phase, index)
        return (
          <li key={step}>
            <button
              type="button"
              aria-current={status === "active" ? "step" : undefined}
              onClick={() => {
                onSelect(index)
              }}
              className="flex w-full cursor-pointer flex-col gap-2 text-left"
            >
              <span className="relative h-0.5 w-full overflow-hidden rounded-full bg-line-strong">
                <motion.span
                  key={status === "active" ? `active-${String(phase)}` : status}
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  initial={{ width: status === "done" ? "100%" : "0%" }}
                  animate={{ width: status === "idle" ? "0%" : "100%" }}
                  transition={{
                    duration: status === "active" ? STEP_MS / 1000 : 0.3,
                    ease: "linear",
                  }}
                />
              </span>
              <span className="flex items-baseline gap-2 font-mono text-[10px]">
                <span className="text-fg-faint tabular">{String(index + 1).padStart(2, "0")}</span>
                <span
                  className={cn(
                    "truncate transition-colors duration-500",
                    status === "idle" ? "text-fg-faint" : "text-fg",
                  )}
                >
                  {step}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** One scene on its own clock; remounted per proof type so every story starts from step one. */
function Stage({ type, spec }: { type: ProofType; spec: SceneSpec }) {
  const scene = SCENES[type.scene]
  const steps = scene.steps(spec)
  const { ref, phase, setPhase } = useTimeline(steps.length)
  const { Scene } = scene
  return (
    <div ref={ref} className="flex h-full flex-col gap-6">
      <div className="flex flex-1 items-center">
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          className="w-full"
          role="img"
          aria-label={scene.label}
        >
          <Scene phase={phase} spec={spec} type={type} />
        </svg>
      </div>
      <StepRail steps={steps} phase={phase} onSelect={setPhase} />
    </div>
  )
}

/**
 * What is being proved: one proof type at a time, an animated diagram on the left and an
 * equal-height explanation on the right, including what goes into the proof.
 */
export function ProofTypes({ challenge }: { challenge: Challenge }) {
  const types = proofTypes(challenge)
  const [active, setActive] = useState(types[0]?.id ?? "")
  const current = types.find((type) => type.id === active) ?? types[0]
  if (current === undefined) return null
  const spec = sceneSpec(challenge)

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
        <div className="relative flex min-h-[22rem] overflow-hidden rounded-2xl border border-line bg-bg-raised bg-[radial-gradient(var(--ar-line-strong)_1px,transparent_1px)] [background-size:18px_18px] p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              className="h-full w-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <Stage type={current} spec={spec} />
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
