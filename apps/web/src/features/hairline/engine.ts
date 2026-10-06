/**
 * The drawing engine behind the line figures: an orthographic camera, rounded solids drawn as a
 * silhouette and one crease, springs, one shared frame loop that sleeps off screen, and pointer
 * input in drawing units.
 *
 * The method and the arithmetic follow Hairline by Lucas Marques
 * (https://github.com/lucasmarkes/hairline, MIT licence, copyright (c) 2026 Lucas Marques). The
 * figures drawn with it here are this site's own.
 *
 * Every figure is drawn in a 400 x 320 box and scaled by the svg. World space is x/y on the
 * ground and z up. There is no perspective and no hidden-line removal: plates are filled with
 * the ground colour and painted back to front, so a nearer one covers a farther one.
 */

export type Vec2 = readonly [number, number]
export type Vec3 = readonly [number, number, number]

/** A sample on a rounded outline, with its outward normal on the ground plane. */
export interface Sample {
  u: number
  v: number
  nu: number
  nv: number
}

/** `az` in radians, `k` the sine of the elevation, `S` the scale, `ox`/`oy` the screen offset. */
export interface Camera {
  az: number
  k: number
  S: number
  ox: number
  oy: number
}

export type Projector = (x: number, y: number, z: number) => Vec2

export const VIEW = { width: 400, height: 320 } as const

export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

const r2 = (value: number): string => String(Math.round(value * 100) / 100)

const point = (p: Vec2): string => `${r2(p[0])} ${r2(p[1])}`

/** A closed path through the points. */
export const poly = (points: readonly Vec2[]): string => `M${points.map(point).join("L")}Z`

/** An open polyline; empty for fewer than two points. */
export const open = (points: readonly Vec2[]): string =>
  points.length < 2 ? "" : `M${points.map(point).join("L")}`

/** One straight segment as its own subpath. */
export const seg = (a: Vec2, b: Vec2): string => `M${point(a)}L${point(b)}`

export const camera = (azimuthDegrees: number, k: number, S: number): Camera => ({
  az: (azimuthDegrees * Math.PI) / 180,
  k,
  S,
  ox: 0,
  oy: 0,
})

export function projector(C: Camera): Projector {
  const c = Math.cos(C.az)
  const s = Math.sin(C.az)
  const lift = Math.sqrt(1 - C.k * C.k)
  return (x, y, z) => {
    const X = x * c - y * s
    const Y = x * s + y * c
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * lift)]
  }
}

/** The world x/y under a screen point, on the plane at height z. */
export function unproject(C: Camera, sx: number, sy: number, z: number): Vec2 {
  const c = Math.cos(C.az)
  const s = Math.sin(C.az)
  const lift = Math.sqrt(1 - C.k * C.k)
  const X = (sx - C.ox) / C.S
  const Y = ((sy - C.oy) / C.S + z * lift) / C.k
  return [X * c + Y * s, -X * s + Y * c]
}

/** Sets the camera's offset so the bounding box of the points is centred on (cx, cy). */
export function fit(C: Camera, points: readonly Vec3[], cx: number, cy: number): void {
  C.ox = 0
  C.oy = 0
  const P = projector(C)
  const projected = points.map((p) => P(p[0], p[1], p[2]))
  const xs = projected.map((p) => p[0])
  const ys = projected.map((p) => p[1])
  C.ox = cx - (Math.min(...xs) + Math.max(...xs)) / 2
  C.oy = cy - (Math.min(...ys) + Math.max(...ys)) / 2
}

/** A rounded rectangle, sampled, `n` steps per corner. */
export function roundedRect(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  radius: number,
  n = 4,
): Sample[] {
  const r = Math.max(0, Math.min(radius, (u1 - u0) / 2, (v1 - v0) / 2))
  const corners: readonly Vec3[] = [
    [u1 - r, v1 - r, 0],
    [u0 + r, v1 - r, 90],
    [u0 + r, v0 + r, 180],
    [u1 - r, v0 + r, 270],
  ]
  const out: Sample[] = []
  for (const [cu, cv, start] of corners)
    for (let step = 0; step <= n; step += 1) {
      const angle = ((start + (90 * step) / n) * Math.PI) / 180
      const ca = Math.cos(angle)
      const sa = Math.sin(angle)
      out.push({ u: cu + r * ca, v: cv + r * sa, nu: ca, nv: sa })
    }
  return out
}

const cross = (o: Vec2, a: Vec2, b: Vec2): number =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

/** Convex hull (monotone chain). */
export function hull(input: readonly Vec2[]): Vec2[] {
  const points = input.toSorted((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
  const build = (ordered: readonly Vec2[]): Vec2[] => {
    const chain: Vec2[] = []
    for (const p of ordered) {
      for (;;) {
        const a = chain.at(-2)
        const b = chain.at(-1)
        if (a === undefined || b === undefined || cross(a, b, p) > 0) break
        chain.pop()
      }
      chain.push(p)
    }
    chain.pop()
    return chain
  }
  return [...build(points), ...build(points.toReversed())]
}

const ringAt = (P: Projector, ring: readonly Sample[], z: number): Vec2[] =>
  ring.map((q) => P(q.u, q.v, z))

/** Whether a sample's normal faces the camera. */
export const facing = (C: Camera): ((q: Sample) => boolean) => {
  const s = Math.sin(C.az)
  const c = Math.cos(C.az)
  return (q) => q.nu * s + q.nv * c >= -1e-6
}

/** The one cyclic run of samples that pass `keep`, in ring order. */
function run(ring: readonly Sample[], keep: (q: Sample) => boolean): Sample[] {
  const n = ring.length
  const at = (index: number): Sample | undefined => ring[((index % n) + n) % n]
  let start = -1
  for (let i = 0; i < n; i += 1) {
    const here = at(i)
    const before = at(i - 1)
    if (here !== undefined && before !== undefined && keep(here) && !keep(before)) {
      start = i
      break
    }
  }
  if (start < 0) return ring.every(keep) ? [...ring] : []
  const out: Sample[] = []
  for (let step = 0; step < n; step += 1) {
    const q = at(start + step)
    if (q === undefined || !keep(q)) break
    out.push(q)
  }
  return out
}

export interface PrismPaths {
  sil: string
  crease: string
}

/**
 * A prism standing from z0 to z1: its silhouette is the hull of its two rings, so no vertical
 * corner is drawn, and its only inner line is the front run of an inset ring on the lid.
 */
export function prism(
  P: Projector,
  front: (q: Sample) => boolean,
  ring: readonly Sample[],
  inner: readonly Sample[] | null,
  z0: number,
  z1: number,
): PrismPaths {
  return {
    sil: poly(hull([...ringAt(P, ring, z1), ...ringAt(P, ring, z0)])),
    crease: inner === null ? "" : open(ringAt(P, run(inner, front), z1)),
  }
}

/** A rounded footprint and its crease ring, inset by `bevel`. */
export const rings = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number,
  bevel: number,
): [Sample[], Sample[]] => [
  roundedRect(x0, y0, x1, y1, radius),
  roundedRect(x0 + bevel, y0 + bevel, x1 - bevel, y1 - bevel, Math.max(0.3, radius - bevel)),
]

/* ---------- motion ---------- */

let reduced = false
export const reducedMotion = (): boolean => reduced

export interface Spring {
  x: number
  v: number
  t: number
  k: number
  c: number
  eps: number
}

/** A spring at rest on x: stiffness 100, damping 18, unit mass. */
export const spring = (x: number, eps = 0.01): Spring => ({ x, v: 0, t: x, k: 100, c: 18, eps })

/** Advances a spring by dt seconds toward its target. Returns whether it is still moving. */
export function stepSpring(sp: Spring, dt: number): boolean {
  if (reduced) {
    sp.x = sp.t
    sp.v = 0
    return false
  }
  const steps = Math.max(1, Math.ceil(dt * 240))
  const h = dt / steps
  for (let i = 0; i < steps; i += 1) {
    sp.v += (-sp.k * (sp.x - sp.t) - sp.c * sp.v) * h
    sp.x += sp.v * h
  }
  if (Math.abs(sp.x - sp.t) < sp.eps && Math.abs(sp.v) < sp.eps * 10) {
    sp.x = sp.t
    sp.v = 0
    return false
  }
  return true
}

/* ---------- svg ---------- */

const NS = "http://www.w3.org/2000/svg"

export function make<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number>>,
  parent: Element,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag)
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value))
  parent.appendChild(element)
  return element
}

/** A solid's two paths in one group: the silhouette and its crease. */
export interface Solid {
  g: SVGGElement
  sil: SVGPathElement
  cr: SVGPathElement
}

export function solid(parent: Element): Solid {
  const g = make("g", {}, parent)
  return { g, sil: make("path", { class: "sil" }, g), cr: make("path", { class: "nf lo" }, g) }
}

export const put = (element: Solid, paths: PrismPaths): void => {
  element.sil.setAttribute("d", paths.sil)
  element.cr.setAttribute("d", paths.crease)
}

export const place = (element: SVGElement, at: Vec2): void => {
  element.setAttribute("cx", r2(at[0]))
  element.setAttribute("cy", r2(at[1]))
}

/* ---------- one loop, asleep off screen ---------- */

/** A figure's frame: dt in seconds (capped at 50 ms). Returns whether it wants another frame. */
export type Tick = (dt: number) => boolean

export interface Loop {
  wake: () => void
  unregister: () => void
}

interface Board {
  tick: Tick
  visible: boolean
  awake: boolean
}

let boards: Board[] = []
const byStage = new Map<Element, Board>()
let frameId = 0
let last = 0
let observer: IntersectionObserver | null = null
let motionQuery: MediaQueryList | null = null

function frame(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
  last = now
  let any = false
  for (const board of [...boards])
    if (board.visible && board.awake) {
      board.awake = board.tick(dt)
      any = any || board.awake
    }
  frameId = any ? requestAnimationFrame(frame) : 0
}

function wake(board: Board): void {
  board.awake = true
  if (frameId === 0) {
    last = performance.now()
    frameId = requestAnimationFrame(frame)
  }
}

const onMotionChange = (): void => {
  reduced = motionQuery?.matches ?? false
  for (const board of boards) wake(board)
}

/**
 * Joins the shared loop. The tick runs once now, then on every frame while the stage is near
 * the viewport and the tick keeps returning true.
 */
export function register(stage: Element, tick: Tick): Loop {
  if (observer === null) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const board = byStage.get(entry.target)
          if (board === undefined) continue
          board.visible = entry.isIntersecting
          if (board.visible) wake(board)
        }
      },
      { rootMargin: "80px" },
    )
    motionQuery = matchMedia("(prefers-reduced-motion: reduce)")
    reduced = motionQuery.matches
    motionQuery.addEventListener("change", onMotionChange)
  }
  const board: Board = { tick, visible: false, awake: true }
  boards.push(board)
  byStage.set(stage, board)
  observer.observe(stage)
  tick(0)
  let gone = false
  return {
    wake: () => {
      if (!gone) wake(board)
    },
    unregister: () => {
      if (gone) return
      gone = true
      boards = boards.filter((other) => other !== board)
      byStage.delete(stage)
      observer?.unobserve(stage)
      if (boards.length > 0) return
      if (frameId !== 0) cancelAnimationFrame(frameId)
      frameId = 0
      observer?.disconnect()
      observer = null
      motionQuery?.removeEventListener("change", onMotionChange)
      motionQuery = null
    },
  }
}

/**
 * Pointer input in drawing units. A mouse leaving acts at once; a finger lifting holds the pose
 * for 1.4 s first, so a tap reads as a look. Returns the disposer.
 */
export function pointer(
  stage: HTMLElement,
  on: { move: (p: Vec2) => void; leave: () => void },
): () => void {
  let timer = 0
  const at = (event: PointerEvent): Vec2 => {
    const box = stage.getBoundingClientRect()
    return [
      ((event.clientX - box.left) / box.width) * VIEW.width,
      ((event.clientY - box.top) / box.height) * VIEW.height,
    ]
  }
  const move = (event: PointerEvent): void => {
    window.clearTimeout(timer)
    on.move(at(event))
  }
  const leave = (event: PointerEvent): void => {
    window.clearTimeout(timer)
    timer = window.setTimeout(on.leave, event.pointerType === "mouse" ? 0 : 1400)
  }
  stage.addEventListener("pointermove", move)
  stage.addEventListener("pointerdown", move)
  stage.addEventListener("pointerleave", leave)
  return () => {
    window.clearTimeout(timer)
    stage.removeEventListener("pointermove", move)
    stage.removeEventListener("pointerdown", move)
    stage.removeEventListener("pointerleave", leave)
  }
}

/** What a figure is handed, and what it gives back: its tear-down. */
export interface FigureContext {
  stage: HTMLElement
  svg: SVGSVGElement
  /** Writes the figure's caption. */
  read: (text: string) => void
}

export type FigureMount<Data = undefined> = (context: FigureContext, data: Data) => () => void
