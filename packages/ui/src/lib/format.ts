const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

/** Format a number with grouping and a fixed number of fraction digits. */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (fractionDigits === 0) return integer.format(value)
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)
}

/** Format a ratio (0.1234) as a signed percentage string ("−12.34%"). */
export function formatPercent(ratio: number, fractionDigits = 2, signed = false): string {
  const pct = formatNumber(Math.abs(ratio) * 100, fractionDigits)
  if (!signed || ratio === 0) return `${pct}%`
  return `${ratio < 0 ? "−" : "+"}${pct}%`
}

/** Format a signed number using a true minus sign. */
export function formatSigned(value: number, fractionDigits = 0): string {
  const abs = formatNumber(Math.abs(value), fractionDigits)
  if (value === 0) return abs
  return `${value < 0 ? "−" : "+"}${abs}`
}
