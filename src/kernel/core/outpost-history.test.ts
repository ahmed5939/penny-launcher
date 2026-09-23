import { describe, expect, it } from 'vitest'

import { availableOutpostSaves } from './outpost-history'

describe('availableOutpostSaves', () => {
  it('uses cloud upload dates and includes the matching archive backup', () => {
    const records = [{ recordFilename: 'zone-abc_A1_01.sav' }]
    const files = [
      { filename: 'zone-abc_A0_00.sav', uploaded: '2023-10-30T10:00:00Z' },
      { filename: 'zone-abc_A1_01.sav', uploaded: '2023-10-30T10:05:00Z' },
      { filename: 'other-zone_A0_00.sav', uploaded: '2021-01-01T00:00:00Z' },
    ]

    expect(availableOutpostSaves(records, files)).toEqual([
      { recordFilename: 'zone-abc_A0_00.sav', lastModified: '2023-10-30T10:00:00Z' },
      { recordFilename: 'zone-abc_A1_01.sav', lastModified: '2023-10-30T10:05:00Z' },
    ])
  })
})
