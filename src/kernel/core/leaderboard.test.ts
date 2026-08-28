import { describe, expect, it } from 'vitest'

import { pennyDBProfileUrl } from '../../services/endpoints/pennydb'

import {
  isLeaderboardMetric,
  isLinkablePennyDBDisplayName,
  parseLeaderboardResponse,
  parseLeaderboardRow,
} from './leaderboard-parse'

describe('PennyDB leaderboard parsing', () => {
  it('accepts only the metrics the public API ranks', () => {
    expect(isLeaderboardMetric('power_level')).toBe(true)
    expect(isLeaderboardMetric('llamas_opened')).toBe(true)
    expect(isLeaderboardMetric('vbucks')).toBe(false)
    expect(isLeaderboardMetric(1)).toBe(false)
  })

  it('reads rank, name and value without treating epic_account_id as Epic id', () => {
    const row = parseLeaderboardRow(
      {
        profile_id: 125,
        current_value: 136149,
        yesterday_value: 136000,
        delta_1d: 149,
        leaderboard_position: 1,
        display_name: 'Y 3',
        epic_account_id: '125',
      },
      0
    )

    expect(row).toEqual({
      profileId: 125,
      rank: 1,
      displayName: 'Y 3',
      value: 136149,
      previousValue: 136000,
      delta: 149,
    })
    expect(row && 'epicAccountId' in row).toBe(false)
    expect(row && 'epic_account_id' in row).toBe(false)
  })

  it('drops rows with no numeric value and caps the table', () => {
    const payload = parseLeaderboardResponse(
      {
        rows: [
          { display_name: 'No score' },
          ...Array.from({ length: 120 }, (_, index) => ({
            profile_id: index + 1,
            current_value: 10,
            leaderboard_position: index + 1,
            display_name: `Player ${index + 1}`,
            epic_account_id: `${index + 1}`,
          })),
        ],
      },
      'power_level'
    )

    expect(payload.rows).toHaveLength(100)
    expect(payload.rows[0]?.displayName).toBe('Player 1')
  })

  it('only links display names PennyDB can look up', () => {
    expect(isLinkablePennyDBDisplayName('Plingindigo')).toBe(true)
    expect(isLinkablePennyDBDisplayName('')).toBe(false)
    expect(
      isLinkablePennyDBDisplayName(
        '{"id":"a5a35395f99f49e1b48ead3f285064b1","externalAuths":{}}'
      )
    ).toBe(false)
  })

  it('opens profiles by display name, not PennyDB epic_account_id', () => {
    expect(pennyDBProfileUrl('Y 3')).toBe(
      'https://pennydb.net/profile/Y%203'
    )
    expect(pennyDBProfileUrl('125')).not.toBe(
      pennyDBProfileUrl('Y 3')
    )
  })
})
