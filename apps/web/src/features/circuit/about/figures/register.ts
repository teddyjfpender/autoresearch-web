import {
  camera,
  clamp,
  facing,
  fit,
  pointer,
  prism,
  projector,
  put,
  register,
  rings,
  solid,
  spring,
  stepSpring,
  unproject,
  make,
  type FigureMount,
  type Sample,
  type Solid,
  type Spring,
  type Vec2,
} from "../../../hairline/engine"

/**
 * The active space as a register: 54 orbitals, each a pair of blocks for its two spin orbitals,
 * so 108 qubits. At rest the low-energy orbitals stand tall (occupied) and the rest lie low. The
 * pointer raises the orbitals around it; the one under it takes the bright stroke and the
 * caption names its two qubits.
 */

const COLS = 9
const ROWS = 6
const CELL_X = 15
const CELL_Y = 14
const HALF = 5.4
const DEPTH = 10
const HIGH = 30
const REACH = 3.2
const BASE = 5

/** 1 at the pointer, falling to a floor at the edge of the reach and beyond. */
const falloff = (u: number): number =>
  u <= 0
    ? 1
    : u <= 0.417
      ? 1 - (u / 0.417) * 0.6875
      : u <= 1
        ? 0.3125 - ((u - 0.417) / 0.583) * 0.2185
        : 0.094

interface Cell {
  i: number
  j: number
  rest: number
  height: Spring
  drawn: number
  halves: { ring: Sample[]; inner: Sample[]; element: Solid }[]
}

export const orbitalRegister: FigureMount = ({ stage, svg, read }) => {
  const width = COLS * CELL_X
  const depth = ROWS * CELL_Y
  const C = camera(45, 0.5, 1.75)
  fit(
    C,
    [
      [-6, -6, -BASE],
      [width + 6, depth + 6, -BASE],
      [width + 6, -6, -BASE],
      [-6, depth + 6, -BASE],
      [0, 0, HIGH * 0.8],
    ],
    200,
    168,
  )
  const P = projector(C)
  const front = facing(C)
  const g = make("g", {}, svg)
  const [plinth, plinthInner] = rings(-6, -6, width + 6, depth + 6, 8, 2.2)
  put(solid(g), prism(P, front, plinth, plinthInner, -BASE, 0))

  // Diagonal by diagonal from the far corner, so appending is painting back to front.
  const cells: Cell[] = []
  for (let s = 0; s <= COLS + ROWS - 2; s += 1)
    for (let i = 0; i < COLS; i += 1) {
      const j = s - i
      if (j < 0 || j >= ROWS) continue
      const energy = (i / (COLS - 1) + j / (ROWS - 1)) / 2
      const rest = 3 + 15 / (1 + Math.exp((energy - 0.46) * 16))
      const y0 = j * CELL_Y + (CELL_Y - DEPTH) / 2
      const halves = [0, 1].map((spin) => {
        const x0 = i * CELL_X + (CELL_X - 2 * HALF - 1) / 2 + spin * (HALF + 1)
        const [ring, inner] = rings(x0, y0, x0 + HALF, y0 + DEPTH, 1.8, 0.8)
        return { ring, inner, element: solid(g) }
      })
      cells.push({ i, j, rest, height: spring(rest, 0.04), drawn: Number.NaN, halves })
    }

  // At rest the bright pair is the highest occupied orbital: the edge of the filled region.
  const frontier = cells.reduce((best, cell) =>
    Math.abs(cell.rest - 10.5) < Math.abs(best.rest - 10.5) ? cell : best,
  )
  let over: Vec2 | null = null
  let lit: Cell = frontier

  const loop = register(stage, (dt) => {
    let moving = false
    for (const cell of cells) {
      if (stepSpring(cell.height, dt)) moving = true
      const h = Math.max(0.6, cell.height.x)
      if (h === cell.drawn) continue
      cell.drawn = h
      for (const half of cell.halves)
        put(half.element, prism(P, front, half.ring, half.inner, 0, h))
    }
    return moving
  })

  const light = (cell: Cell): void => {
    for (const half of lit.halves) half.element.sil.classList.remove("hi")
    lit = cell
    for (const half of lit.halves) half.element.sil.classList.add("hi")
  }

  const retarget = (): void => {
    if (over === null) {
      for (const cell of cells) cell.height.t = cell.rest
      light(frontier)
      read(`${String(COLS * ROWS)} orbitals · ${String(COLS * ROWS * 2)} qubits`)
    } else {
      const [ox, oy] = over
      for (const cell of cells) {
        const dx = (cell.i + 0.5) * CELL_X - ox
        const dy = (cell.j + 0.5) * CELL_Y - oy
        const lift = HIGH * falloff(Math.hypot(dx, dy) / (REACH * CELL_X))
        cell.height.t = Math.max(cell.rest * 0.6, lift)
      }
      const i = clamp(Math.floor(ox / CELL_X), 0, COLS - 1)
      const j = clamp(Math.floor(oy / CELL_Y), 0, ROWS - 1)
      const hot = cells.find((cell) => cell.i === i && cell.j === j)
      if (hot !== undefined) light(hot)
      const orbital = j * COLS + i + 1
      read(
        `orbital ${String(orbital)} of ${String(COLS * ROWS)} · qubits ${String(2 * orbital - 1)} and ${String(2 * orbital)}`,
      )
    }
    loop.wake()
  }
  retarget()

  const stop = pointer(stage, {
    move: (p) => {
      over = unproject(C, p[0], p[1], 0)
      retarget()
    },
    leave: () => {
      over = null
      retarget()
    },
  })

  return () => {
    stop()
    loop.unregister()
  }
}
