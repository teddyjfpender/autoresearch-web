import {
  camera,
  clamp,
  facing,
  fit,
  make,
  pointer,
  prism,
  projector,
  put,
  register,
  rings,
  solid,
  spring,
  stepSpring,
  type FigureMount,
} from "../../../hairline/engine"

/**
 * The score as a slab. Its length is a circuit's peak qubits and its height the Toffolis of one
 * walk step, so the area of its long face is the score. The dashed outline behind it is the
 * baseline. At rest the slab is the best circuit on the board; the pointer walks it along the
 * trade-off front, from the fewest qubits on the left to the fewest Toffolis on the right.
 */

export interface TradePoint {
  qubits: number
  toffoli: number
}

export interface TradeData {
  /** The Toffoli-qubit front of the track. */
  front: readonly TradePoint[]
  best: TradePoint | null
  baseline: TradePoint | null
}

const LENGTH = 190
const HEIGHT = 112
const DEPTH = 30
const BASE = 4

const noop = (): void => {
  /* nothing was mounted */
}

const whole = (value: number): string => Math.round(value).toLocaleString("en-US")
const millions = (value: number): string => `${(value / 1e6).toFixed(2)}M`

export const tradeSlab: FigureMount<TradeData> = ({ stage, svg, read }, data) => {
  const front = data.front.toSorted((a, b) => a.qubits - b.qubits)
  const rest = data.best ?? front[0] ?? null
  if (rest === null) {
    read("no circuits yet")
    return noop
  }
  const every = [...front, rest, ...(data.baseline === null ? [] : [data.baseline])]
  const perQubit = LENGTH / Math.max(...every.map((point) => point.qubits))
  const perToffoli = HEIGHT / Math.max(...every.map((point) => point.toffoli))

  const C = camera(28, 0.42, 1.36)
  fit(
    C,
    [
      [-8, -8, -BASE],
      [LENGTH + 8, DEPTH + 8, -BASE],
      [LENGTH + 8, -8, -BASE],
      [-8, DEPTH + 8, -BASE],
      [0, 0, HEIGHT],
      [LENGTH, 0, HEIGHT],
    ],
    200,
    164,
  )
  const P = projector(C)
  const facingCamera = facing(C)
  const g = make("g", {}, svg)
  const [plinth, plinthInner] = rings(-8, -8, LENGTH + 8, DEPTH + 8, 8, 2.2)
  put(solid(g), prism(P, facingCamera, plinth, plinthInner, -BASE, 0))
  if (data.baseline !== null) {
    // The guide is painted before the slab, so the slab covers the part of it that lies behind.
    const [ring] = rings(0, 0, data.baseline.qubits * perQubit, DEPTH, 3, 1)
    const outline = prism(P, facingCamera, ring, null, 0, data.baseline.toffoli * perToffoli)
    make("path", { class: "nf dash", d: outline.sil }, g)
  }
  const slab = solid(g)
  slab.sil.classList.add("hi")

  const length = spring(rest.qubits * perQubit, 0.05)
  const height = spring(rest.toffoli * perToffoli, 0.05)
  let drawn = ""

  const loop = register(stage, (dt) => {
    const a = stepSpring(length, dt)
    const b = stepSpring(height, dt)
    const key = `${length.x.toFixed(2)},${height.x.toFixed(2)}`
    if (key !== drawn) {
      drawn = key
      const [ring, inner] = rings(0, 0, Math.max(6, length.x), DEPTH, 3, 1.4)
      put(slab, prism(P, facingCamera, ring, inner, 0, Math.max(2, height.x)))
    }
    return a || b
  })

  const show = (point: TradePoint): void => {
    length.t = point.qubits * perQubit
    height.t = point.toffoli * perToffoli
    const score = point.qubits * point.toffoli
    const below =
      data.baseline === null
        ? ""
        : ` · ${String(Math.round((1 - score / (data.baseline.qubits * data.baseline.toffoli)) * 100))}% below baseline`
    read(
      `${whole(point.qubits)} qubits × ${whole(point.toffoli)} Toffolis = ${millions(score)}${below}`,
    )
    loop.wake()
  }
  show(rest)

  const stop = pointer(stage, {
    move: (p) => {
      if (front.length === 0) return
      const along = clamp((p[0] - 70) / 260, 0, 1)
      const point = front[Math.round(along * (front.length - 1))]
      if (point !== undefined) show(point)
    },
    leave: () => {
      show(rest)
    },
  })

  return () => {
    stop()
    loop.unregister()
  }
}
