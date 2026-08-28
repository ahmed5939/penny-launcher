import { describe, expect, it } from 'vitest'

import {
  isPennyDBVBuckReward,
  missionHasPennyDBAlert,
  missionHasPennyDBVBucks,
  type PennyDBMission,
} from './pennydb'

describe('Penny DB mission helpers', () => {
  it('recognises V-Buck rewards by item type or name', () => {
    expect(
      isPennyDBVBuckReward({
        itemType: 'AccountResource:currency_mtxswap',
        name: 'V-Bucks',
      })
    ).toBe(true)
    expect(
      isPennyDBVBuckReward({
        itemType: 'CardPack:zcp_currency_mtxswap',
        name: 'VBucks',
      })
    ).toBe(true)
    expect(
      isPennyDBVBuckReward({
        itemType: 'AccountResource:reagent_c_t03',
        name: 'Eye of the Storm',
      })
    ).toBe(false)
  })

  it('flags missions that carry V-Bucks or alert rewards', () => {
    const vbucks: PennyDBMission = {
      alertRewards: [
        { itemType: 'AccountResource:currency_mtxswap', name: 'V-Bucks' },
      ],
    }
    const alertOnly: PennyDBMission = {
      alertRewards: [{ itemType: 'AccountResource:reagent_c_t03', quantity: 14 }],
    }
    const baseOnly: PennyDBMission = {
      rewards: [{ itemType: 'CardPack:zcp_personnelxp_t04', name: 'People XP' }],
    }

    expect(missionHasPennyDBVBucks(vbucks)).toBe(true)
    expect(missionHasPennyDBAlert(vbucks)).toBe(true)
    expect(missionHasPennyDBVBucks(alertOnly)).toBe(false)
    expect(missionHasPennyDBAlert(alertOnly)).toBe(true)
    expect(missionHasPennyDBVBucks(baseOnly)).toBe(false)
    expect(missionHasPennyDBAlert(baseOnly)).toBe(false)
  })
})
