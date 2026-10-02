/** Server-rendered trend line for an evenly spaced series, normalised into a fixed viewBox. */
export function Sparkline({
  values,
  step = false,
  className,
}: {
  values: readonly number[]
  /** Draw as a staircase (records) instead of straight segments. */
  step?: boolean
  className?: string
}) {
  if (values.length < 2) return null
  const width = 400
  const height = 140
  const max = Math.max(...values)
  const min = Math.min(...values)
  const x = (index: number) => (index / (values.length - 1)) * width
  const y = (value: number) => 8 + ((max - value) / Math.max(1e-9, max - min)) * (height - 16)
  let line = ""
  for (const [index, value] of values.entries()) {
    if (index === 0) line += `M0,${y(value).toFixed(1)}`
    else if (step) line += `H${x(index).toFixed(1)}V${y(value).toFixed(1)}`
    else line += `L${x(index).toFixed(1)},${y(value).toFixed(1)}`
  }
  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ar-accent)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--ar-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}V${String(height)}H0Z`} fill="url(#spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="var(--ar-accent)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
