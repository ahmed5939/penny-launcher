/** Number words for the Rewind: whole, grouped for the locale. */

export function formatCount(value: number) {
  return Math.round(value).toLocaleString()
}

export function formatHours(hours: number) {
  return Math.round(hours).toLocaleString()
}

export function formatPercent(value: number) {
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`
}

export function sinceYear(iso: string) {
  return new Date(iso).getFullYear().toString()
}

export function sinceMonth(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

/** Save the World Power, to the hundredth as the Profile page shows it. */
export function formatPower(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}
