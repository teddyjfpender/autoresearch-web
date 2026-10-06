"use client"

import { formatNumber } from "@autoresearch/ui/lib/format"
import { useMemo, type ReactNode } from "react"

import type { CircuitTarget, CircuitTrackBoard } from "@/data/circuit/schema"
import { formatProduct, formatToffoli } from "@/lib/circuit"

import { Hairline } from "../../hairline/hairline"
import { cofactor } from "./figures/cofactor"
import { surfacePatch } from "./figures/patch"
import { orbitalRegister } from "./figures/register"
import { tradeSlab, type TradeData } from "./figures/trade"

function Section({
  index,
  title,
  figure,
  flip = false,
  children,
}: {
  index: string
  title: string
  figure: ReactNode
  /** Put the drawing on the left on wide screens. */
  flip?: boolean
  children: ReactNode
}) {
  return (
    <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? undefined : "lg:order-2"}>{figure}</div>
      <div className="max-w-xl">
        <p className="text-label">{index}</p>
        <h3 className="mt-3 text-2xl tracking-tight sm:text-3xl">{title}</h3>
        <div className="mt-4 space-y-4 text-fg-muted">{children}</div>
      </div>
    </section>
  )
}

/**
 * Why the FeMoco challenge matters, in four drawings: the molecule, how it becomes qubits, why
 * qubits and Toffolis are what cost, and what the score measures. Each drawing answers the
 * pointer and says what it is showing in its caption.
 */
export function FemocoAbout({
  board,
  targets,
}: {
  board: CircuitTrackBoard
  targets: readonly CircuitTarget[]
}) {
  const baseline = board.baseline ?? null
  const trade = useMemo<TradeData>(
    () => ({
      front: board.front.map(({ qubits, toffoli }) => ({ qubits, toffoli })),
      best: board.best === null ? null : { qubits: board.best.qubits, toffoli: board.best.toffoli },
      baseline: baseline === null ? null : { qubits: baseline.qubits, toffoli: baseline.toffoli },
    }),
    [board.front, board.best, baseline],
  )
  const below =
    baseline === null || board.best === null ? null : 1 - board.best.score / baseline.score

  return (
    <div className="space-y-16 py-4 sm:space-y-24">
      <header className="max-w-3xl">
        <h2 className="text-3xl tracking-tight sm:text-4xl">
          The molecule that turns air into fertiliser, and that no computer can yet solve
        </h2>
        <p className="mt-4 text-lg text-fg-muted">
          FeMoco is the benchmark people reach for when they ask what a quantum computer would be
          for. This challenge asks how cheaply its simulation can be made to run. Move the pointer
          over the drawings.
        </p>
      </header>

      <Section
        index="01 · The molecule"
        title="Nature makes fertiliser at room temperature"
        figure={
          <Hairline
            mount={cofactor}
            data={undefined}
            figure="fig. 1 · the cofactor"
            label="A ball-and-stick drawing of the FeMo cofactor: seven iron atoms, one molybdenum, nine sulfur and a central carbon, turning slowly"
          />
        }
      >
        <p>
          Every plant needs nitrogen it can use, and the nitrogen in air is locked in one of the
          strongest bonds in chemistry. Industry breaks it with the Haber–Bosch process, at hundreds
          of degrees and hundreds of atmospheres, using an estimated one to two percent of the
          world&apos;s energy. Bacteria do the same job in soil, at room temperature, with an enzyme
          called nitrogenase.
        </p>
        <p>
          The reaction happens at FeMoco, the iron–molybdenum cofactor at the enzyme&apos;s core:
          seven iron atoms, one molybdenum, nine sulfur and a single carbon in the middle. How it
          works is still argued over. Its electrons are too strongly entangled for classical
          computers to resolve the small energy differences that separate one proposed mechanism
          from another.
        </p>
      </Section>

      <Section
        index="02 · The encoding"
        flip
        title="Each orbital becomes two qubits"
        figure={
          <Hairline
            mount={orbitalRegister}
            data={undefined}
            figure="fig. 2 · the register"
            label="A grid of 54 paired blocks, one pair per orbital; the low-energy orbitals stand tall and the rest lie low"
          />
        }
      >
        <p>
          A quantum computer holds the cluster&apos;s electrons directly. The model keeps the
          orbitals where the chemistry happens, the active space. Each orbital can hold one spin-up
          and one spin-down electron, so each becomes a pair of qubits.
        </p>
        <p>
          The two tracks are two published active spaces: 54 orbitals (108 qubits) from Reiher et
          al., and 76 orbitals (152 qubits) from Li et al. Every qubit a circuit uses beyond those
          is workspace, and workspace is where designs differ.
        </p>
      </Section>

      <Section
        index="03 · The cost"
        title="Why qubits and Toffolis are what count"
        figure={
          <Hairline
            mount={surfacePatch}
            data={undefined}
            figure="fig. 3 · one logical qubit"
            label="A patch of physical qubits with check tiles between them; an error on one qubit raises the checks that touch it"
          />
        }
      >
        <p>
          Physical qubits make errors constantly. A useful machine spreads each logical qubit over a
          patch of many physical ones and keeps measuring checks between them, which reveal an error
          without reading the data. Each logical qubit in a circuit therefore costs on the order of
          a thousand physical qubits.
        </p>
        <p>
          Most gates are cheap on such a machine. The Toffoli gate is not: each one consumes
          specially prepared states that take most of the machine&apos;s time to make. So the qubit
          count sets how large the computer must be, and the Toffoli count sets how long it must
          run.
        </p>
      </Section>

      <Section
        index="04 · The score"
        flip
        title="One walk step, measured as Toffolis × qubits"
        figure={
          <Hairline
            mount={tradeSlab}
            data={trade}
            figure="fig. 4 · the trade-off"
            label="A slab whose length is a circuit's qubits and whose height is its Toffolis, inside a dashed outline of the baseline"
          />
        }
      >
        <p>
          The energy is read out by quantum phase estimation, which repeats one operation, the walk
          step, many thousands of times. The challenge measures that one step: its Toffolis and its
          peak qubits. The score is their product, the area of the slab&apos;s long face, and lower
          is better.
        </p>
        <p>
          Qubits can be traded for Toffolis and back, which is why the board is ranked by
          architecture and keeps the whole front, not one winner.
          {baseline === null || board.best === null ? null : (
            <>
              {" "}
              The dashed outline is the baseline, the construction of Low et al. (2025), at{" "}
              {formatToffoli(baseline.toffoli)} Toffolis on {formatNumber(baseline.qubits)} qubits.
              The best circuit on this track runs at {formatToffoli(board.best.toffoli)} on{" "}
              {formatNumber(board.best.qubits)}, a score of {formatProduct(board.best.score)}
              {below === null ? "" : `, ${formatNumber(Math.round(below * 100))}% below it`}.
            </>
          )}
        </p>
      </Section>

      <footer className="border-t border-line pt-6 text-xs text-fg-faint">
        <p className="text-label">Sources</p>
        <ul className="mt-3 space-y-1.5">
          <li>
            M. Reiher, N. Wiebe, K. M. Svore, D. Wecker, M. Troyer, Elucidating reaction mechanisms
            on quantum computers, PNAS 114, 7555 (2017).
          </li>
          <li>
            Z. Li, J. Li, N. S. Dattani, C. J. Umrigar, G. K.-L. Chan, The electronic complexity of
            the ground-state of the FeMo cofactor of nitrogenase as relevant to quantum simulations,
            J. Chem. Phys. 150, 024302 (2019).
          </li>
          {targets.map((target) => (
            <li key={target.id}>{target.citation}.</li>
          ))}
          <li>
            The drawings follow the Hairline method by Lucas Marques (MIT licence). The energy share
            of ammonia synthesis is a commonly cited estimate.
          </li>
        </ul>
      </footer>
    </div>
  )
}
