import { expect, it } from 'vitest'

import {
  defaultWorldInfo,
  World,
} from '../../../config/constants/fortnite/world-info'
import { resolveHomeWorldInfo } from './load-world-info'

const reply = {
  missionAlerts: [],
  missions: [],
  theaters: [
    {
      missionRewardNamedWeightsRowName: 'Theater.Stonewood',
      uniqueId: World.Stonewood,
      regions: [],
    },
  ],
}

it('replaces the data with a valid reply', () => {
  const { worldInfo, failed } = resolveHomeWorldInfo(reply, true)

  expect(failed).toBe(false)
  expect(worldInfo?.has(World.Stonewood)).toBe(true)
})

it('keeps the data on screen when the reply fails', () => {
  expect(resolveHomeWorldInfo(defaultWorldInfo, true)).toEqual({
    worldInfo: null,
    failed: true,
  })
  expect(resolveHomeWorldInfo({ theaters: 'nope' }, true)).toEqual({
    worldInfo: null,
    failed: true,
  })
})

it('clears to empty, and flags it, when there is nothing to keep', () => {
  const { worldInfo, failed } = resolveHomeWorldInfo(defaultWorldInfo, false)

  expect(failed).toBe(true)
  expect(worldInfo?.size).toBe(0)
})
