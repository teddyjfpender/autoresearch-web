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
  unproject,
  type FigureMount,
  type Sample,
  type Solid,
  type Spring,
} from "../../../hairline/engine"

/**
 * One error-corrected (logical) qubit: a patch of physical qubits with check tiles between
 * them. The pegs are the physical qubits. An error on one makes it stand up, and the checks
 * that touch it (the tiles with a bevel) lift and take the bright stroke: the error is found
 * from the checks alone, without reading the qubit. The pointer moves the error.
 */

const TILES = 6
const PITCH = 25
const TILE = 21
const PEG = 4.4
const FLAT = 2.2
const FIRED = 6
const UP = 15
const BASE = 4

interface Part {
  key: number
  ring: Sample[]
  inner: Sample[] | null
  element: Solid | null
  height: Spring
  drawn: number
}

interface Tile extends Part {
  i: number
  j: number
  check: boolean
}

interface Peg extends Part {
  i: number
  j: number
}

export const surfacePatch: FigureMount = ({ stage, svg, read }) => {
  const extent = TILES * PITCH
  const C = camera(45, 0.5, 1.62)
  fit(
    C,
    [
      [-8, -8, -BASE],
      [extent + 4, extent + 4, -BASE],
      [extent + 4, -8, -BASE],
      [-8, extent + 4, -BASE],
      [0, 0, UP],
    ],
    200,
    166,
  )
  const P = projector(C)
  const front = facing(C)
  const g = make("g", {}, svg)
  const [plinth, plinthInner] = rings(-9, -9, extent + 5, extent + 5, 9, 2.2)
  put(solid(g), prism(P, front, plinth, plinthInner, -BASE, 0))

  const tiles: Tile[] = []
  for (let i = 0; i < TILES; i += 1)
    for (let j = 0; j < TILES; j += 1) {
      const check = (i + j) % 2 === 0
      const [ring, inner] = rings(i * PITCH, j * PITCH, i * PITCH + TILE, j * PITCH + TILE, 4, 1.8)
      tiles.push({
        i,
        j,
        check,
        key: (i + 0.5) * PITCH + (j + 0.5) * PITCH,
        ring,
        inner: check ? inner : null,
        element: null,
        height: spring(FLAT, 0.03),
        drawn: Number.NaN,
      })
    }
  const pegs: Peg[] = []
  for (let i = 0; i <= TILES; i += 1)
    for (let j = 0; j <= TILES; j += 1) {
      const cx = i * PITCH - (PITCH - TILE) / 2
      const cy = j * PITCH - (PITCH - TILE) / 2
      const [ring] = rings(cx - PEG / 2, cy - PEG / 2, cx + PEG / 2, cy + PEG / 2, 1.6, 0.5)
      pegs.push({
        i,
        j,
        key: cx + cy,
        ring,
        inner: null,
        element: null,
        height: spring(FLAT + 1, 0.03),
        drawn: Number.NaN,
      })
    }
  // Tiles and pegs share one paint order, far corner first.
  const parts: Part[] = [...tiles, ...pegs].toSorted((a, b) => a.key - b.key)
  for (const part of parts) part.element = solid(g)

  const loop = register(stage, (dt) => {
    let moving = false
    for (const part of parts) {
      if (stepSpring(part.height, dt)) moving = true
      const h = part.height.x
      if (h === part.drawn || part.element === null) continue
      part.drawn = h
      put(part.element, prism(P, front, part.ring, part.inner, 0, h))
    }
    return moving
  })

  const fail = (i: number, j: number, hovering: boolean): void => {
    let fired = 0
    for (const tile of tiles) {
      const touches = (tile.i === i || tile.i === i - 1) && (tile.j === j || tile.j === j - 1)
      const on = touches && tile.check
      if (on) fired += 1
      tile.height.t = on ? FIRED : FLAT
      tile.element?.sil.classList.toggle("hi", on)
    }
    for (const peg of pegs) {
      const on = peg.i === i && peg.j === j
      peg.height.t = on ? UP : FLAT + 1
      peg.element?.sil.classList.toggle("hi", on)
    }
    const qubit = j * (TILES + 1) + i + 1
    read(
      hovering
        ? `error on qubit ${String(qubit)} · ${String(fired)} ${fired === 1 ? "check fires" : "checks fire"}`
        : `one logical qubit · ${String((TILES + 1) ** 2)} physical`,
    )
    loop.wake()
  }
  fail(2, 4, false)

  const stop = pointer(stage, {
    move: (p) => {
      const [x, y] = unproject(C, p[0], p[1], 0)
      fail(
        clamp(Math.round(x / PITCH + 0.08), 0, TILES),
        clamp(Math.round(y / PITCH + 0.08), 0, TILES),
        true,
      )
    },
    leave: () => {
      fail(2, 4, false)
    },
  })

  return () => {
    stop()
    loop.unregister()
  }
}
