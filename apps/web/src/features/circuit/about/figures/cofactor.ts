import {
  VIEW,
  make,
  place,
  pointer,
  reducedMotion,
  register,
  spring,
  stepSpring,
  type FigureMount,
  type Vec2,
  type Vec3,
} from "../../../hairline/engine"

/**
 * The FeMo cofactor, Fe7MoS9C, as balls and sticks. Six irons form a trigonal prism around the
 * central carbon; a seventh iron caps one end and the molybdenum the other; nine sulfurs bridge
 * them. It turns slowly at rest. The pointer turns it by hand, and the atom nearest the pointer
 * takes the bright stroke and is named in the caption.
 *
 * Distances are approximate (ångströms, scaled): Fe-C 2.0, Fe-S 2.2, Fe-Fe 2.6.
 */

type Kind = "Fe" | "Mo" | "S" | "C"

interface Atom {
  kind: Kind
  name: string
  at: Vec3
}

const UNIT = 20
const SCALE = 1.8
const TILT = (14 * Math.PI) / 180
const RADIUS: Record<Kind, number> = { Fe: 7, Mo: 9, S: 5, C: 2.6 }

/** A point at radius r and angle a (degrees) around the cluster's long axis, at `axial` along it. */
const around = (r: number, a: number, axial: number): Vec3 => {
  const angle = (a * Math.PI) / 180
  return [axial, r * Math.cos(angle), r * Math.sin(angle)]
}

function cluster(): { atoms: Atom[]; bonds: [number, number][] } {
  const atoms: Atom[] = []
  const bonds: [number, number][] = []
  const add = (kind: Kind, name: string, at: Vec3): number => atoms.push({ kind, name, at }) - 1
  const carbon = add("C", "carbide · the central carbon", [0, 0, 0])
  const cap = add("Fe", "iron · 1 of 7", [3.55, 0, 0])
  const moly = add("Mo", "molybdenum", [-3.6, 0, 0])
  const upper = [0, 120, 240].map((a, i) =>
    add("Fe", `iron · ${String(i + 2)} of 7`, around(1.5, a, 1.3)),
  )
  const lower = [0, 120, 240].map((a, i) =>
    add("Fe", `iron · ${String(i + 5)} of 7`, around(1.5, a, -1.3)),
  )
  for (const iron of [...upper, ...lower]) bonds.push([carbon, iron])
  for (const [i, a] of [0, 120, 240].entries()) {
    const next = (i + 1) % 3
    const top = add("S", `sulfur · ${String(i + 1)} of 9`, around(2, a + 60, 2.6))
    const belt = add("S", `sulfur · ${String(i + 4)} of 9`, around(3.3, a, 0))
    const bottom = add("S", `sulfur · ${String(i + 7)} of 9`, around(2, a + 60, -2.6))
    const pairs: [number, number | undefined][] = [
      [top, cap],
      [top, upper[i]],
      [top, upper[next]],
      [belt, upper[i]],
      [belt, lower[i]],
      [bottom, moly],
      [bottom, lower[i]],
      [bottom, lower[next]],
    ]
    for (const [a0, b0] of pairs) if (b0 !== undefined) bonds.push([a0, b0])
  }
  return { atoms, bonds }
}

interface Placed {
  screen: Vec2
  depth: number
}

/** The atom's screen position and depth with the cluster turned by `turn` about the vertical. */
function pose(at: Vec3, turn: number): Placed {
  const [ax, ay, az] = at
  const x0 = ax * Math.cos(TILT) - az * Math.sin(TILT)
  const z = ax * Math.sin(TILT) + az * Math.cos(TILT)
  const x = x0 * Math.cos(turn) - ay * Math.sin(turn)
  const y = x0 * Math.sin(turn) + ay * Math.cos(turn)
  const s = UNIT * SCALE
  return {
    screen: [VIEW.width / 2 + s * x, VIEW.height / 2 + s * (y * 0.5 - z * 0.866)],
    depth: y * 0.866 + z * 0.5,
  }
}

export const cofactor: FigureMount = ({ stage, svg, read }) => {
  const { atoms, bonds } = cluster()
  const layer = make("g", {}, svg)
  const sticks = bonds.map(() => make("path", { class: "nf" }, layer))
  const balls = atoms.map((atom) => {
    const g = make("g", {}, layer)
    const ball = make(
      "circle",
      { r: RADIUS[atom.kind] * SCALE, class: atom.kind === "C" ? "dot" : "sil" },
      g,
    )
    // The molybdenum carries a second ring, so it reads as the odd one out without a label.
    const ring =
      atom.kind === "Mo" ? make("circle", { r: RADIUS.Mo * SCALE * 0.55, class: "nf lo" }, g) : null
    return { g, ball, ring }
  })
  const turn = spring(0.6, 0.0005)
  let over: Vec2 | null = null
  let chosen = -1
  let order = ""

  const loop = register(stage, (dt) => {
    if (over === null && !reducedMotion()) turn.t += dt * 0.22
    const moving = stepSpring(turn, dt)
    const placed = atoms.map((atom) => pose(atom.at, turn.x))
    const items: { id: string; depth: number; element: SVGElement }[] = []
    for (const [index, p] of placed.entries()) {
      const entry = balls[index]
      if (entry === undefined) continue
      place(entry.ball, p.screen)
      if (entry.ring !== null) place(entry.ring, p.screen)
      items.push({ id: `a${String(index)}`, depth: p.depth, element: entry.g })
    }
    for (const [index, [from, to]] of bonds.entries()) {
      const a = placed[from]
      const b = placed[to]
      const stick = sticks[index]
      if (a === undefined || b === undefined || stick === undefined) continue
      stick.setAttribute(
        "d",
        `M${a.screen[0].toFixed(2)} ${a.screen[1].toFixed(2)}L${b.screen[0].toFixed(2)} ${b.screen[1].toFixed(2)}`,
      )
      // A stick sits just behind the farther of its two atoms, so both balls cover its ends.
      items.push({
        id: `b${String(index)}`,
        depth: Math.min(a.depth, b.depth) - 0.01,
        element: stick,
      })
    }
    items.sort((a, b) => a.depth - b.depth)
    const signature = items.map((item) => item.id).join()
    if (signature !== order) {
      order = signature
      for (const item of items) layer.appendChild(item.element)
    }
    return !reducedMotion() || moving
  })

  const choose = (index: number): void => {
    if (index === chosen) return
    chosen = index
    for (const [i, entry] of balls.entries()) {
      const kind = atoms[i]?.kind
      if (kind === "C") entry.ball.setAttribute("class", index < 0 || index === i ? "dot" : "dot m")
      else entry.ball.classList.toggle("hi", index === i)
    }
    read(index < 0 ? "FeMoco · Fe₇MoS₉C" : (atoms[index]?.name ?? ""))
  }
  choose(-1)
  read("FeMoco · Fe₇MoS₉C")

  const stop = pointer(stage, {
    move: (p) => {
      if (over === null) turn.t = turn.x
      const previous = over
      over = p
      if (previous !== null) turn.t += ((p[0] - previous[0]) / VIEW.width) * 3
      // Picked against the pose the cluster is heading to, so a pick never chases a moving atom.
      let best = -1
      let bestDistance = 16
      for (const [index, atom] of atoms.entries()) {
        const q = pose(atom.at, turn.t).screen
        const distance = Math.hypot(q[0] - p[0], q[1] - p[1])
        if (distance < bestDistance) {
          best = index
          bestDistance = distance
        }
      }
      choose(best)
      loop.wake()
    },
    leave: () => {
      over = null
      choose(-1)
      loop.wake()
    },
  })

  return () => {
    stop()
    loop.unregister()
  }
}
