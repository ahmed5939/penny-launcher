import { describe, expect, it } from 'vitest'

import {
  filterPennyDBBoardRows,
  type PennyDBBoardRow,
} from './-pennydb-hooks'

function row(
  partial: Pick<PennyDBBoardRow, 'hasAlert' | 'hasVBucks' | 'zone'>
): PennyDBBoardRow {
  return {
    id: `${partial.zone}-${partial.hasAlert}-${partial.hasVBucks}`,
    mission: {},
    ...partial,
  }
}

describe('filterPennyDBBoardRows', () => {
  const rows = [
    row({ hasAlert: true, hasVBucks: true, zone: 'twine_peaks' }),
    row({ hasAlert: true, hasVBucks: false, zone: 'twine_peaks' }),
    row({ hasAlert: false, hasVBucks: false, zone: 'stonewood' }),
  ]

  it('keeps a zone and can narrow to alerts or V-Bucks', () => {
    expect(filterPennyDBBoardRows(rows, 'twine_peaks', 'all')).toHaveLength(2)
    expect(filterPennyDBBoardRows(rows, 'twine_peaks', 'alerts')).toHaveLength(
      2
    )
    expect(filterPennyDBBoardRows(rows, 'all', 'vbucks')).toHaveLength(1)
    expect(filterPennyDBBoardRows(rows, 'stonewood', 'vbucks')).toHaveLength(0)
  })
})
