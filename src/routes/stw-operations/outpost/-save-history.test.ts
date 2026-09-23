import { describe, expect, it } from 'vitest'

import { savePointsByYear } from './-save-history'

describe('savePointsByYear', () => {
  it('groups real saves by year and keeps the first and last of a busy year', () => {
    const records = [
      ...Array.from({ length: 7 }, (_, index) => ({
        lastModified: `2023-0${index + 1}-15T12:00:00Z`,
        recordFilename: `save-${index}.sav`,
      })),
      { lastModified: '2021-06-01T00:00:00Z', recordFilename: 'old.sav' },
    ]

    const history = savePointsByYear(records)

    expect(history.map(({ year }) => year)).toEqual([2023, 2021])
    expect(history[0].points).toHaveLength(4)
    expect(history[0].points[0].recordFilename).toBe('save-0.sav')
    expect(history[0].points.at(-1)?.recordFilename).toBe('save-6.sav')
    expect(history[1].points[0].recordFilename).toBe('old.sav')
  })
})
