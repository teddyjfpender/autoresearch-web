export type ScaleKind = "lin" | "log"

export interface Scale {
  (value: number): number
  ticks: (count: number) => number[]
}

/** Minimal linear/log scale: maps [d0, d1] → [r0, r1]. */
export function createScale(
  kind: ScaleKind,
  domain: [number, number],
  range: [number, number],
): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const transform = kind === "log" ? Math.log10 : (value: number) => value
  const t0 = transform(d0)
  const t1 = transform(d1)
  const span = t1 === t0 ? 1 : t1 - t0
  const scale = ((value: number) => r0 + ((transform(value) - t0) / span) * (r1 - r0)) as Scale
  scale.ticks = (count) => {
    if (kind === "log") {
      const values: number[] = []
      for (let index = 0; index < count; index += 1) {
        values.push(10 ** (t0 + (span * index) / (count - 1)))
      }
      return values
    }
    const rawStep = (d1 - d0) / Math.max(1, count - 1)
    const magnitude = 10 ** Math.floor(Math.log10(rawStep))
    const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? rawStep
    const first = Math.ceil(d0 / step) * step
    const values: number[] = []
    for (let value = first; value <= d1 + step * 1e-9; value += step) values.push(value)
    return values
  }
  return scale
}

export function extent(values: readonly number[], pad = 0.06): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max === min ? Math.abs(max) : max - min
  const delta = (range === 0 ? 1 : range) * pad
  return [Math.max(min - delta, min > 0 ? min * 0.5 : min - delta), max + delta]
}
