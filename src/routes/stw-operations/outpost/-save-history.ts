import type { OutpostZoneInfo } from '../../../kernel/core/outpost-types'

export type SavePoint = OutpostZoneInfo['savedRecords'][number]

/** Keep a few real checkpoints per year without inventing intermediate saves. */
export function savePointsByYear(records: Array<SavePoint>, limit = 4) {
  const years = new Map<number, Array<SavePoint>>()

  for (const record of records) {
    const date = new Date(record.lastModified)

    if (Number.isNaN(date.getTime()) || !record.recordFilename) continue

    const year = date.getUTCFullYear()
    const points = years.get(year) ?? []

    points.push(record)
    years.set(year, points)
  }

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, points]) => {
      const sorted = [...points].sort((a, b) =>
        a.lastModified.localeCompare(b.lastModified)
      )
      const unique = [...new Map(sorted.map((point) => [point.recordFilename, point])).values()]

      if (unique.length <= limit) return { year, points: unique }

      const indexes = new Set(
        Array.from({ length: limit }, (_, index) =>
          Math.round((index * (unique.length - 1)) / (limit - 1))
        )
      )

      return { year, points: unique.filter((_, index) => indexes.has(index)) }
    })
}
