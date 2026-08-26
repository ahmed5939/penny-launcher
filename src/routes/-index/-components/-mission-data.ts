import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'
import type { RewardLike } from '../../../components/page/rarity'

import { isNoisyReward } from '../../../components/page/rarity'

import { zonesCategories } from '../../../config/constants/fortnite/world-info'

/*
 * The reward vocabulary moved to the page kit — four screens outside this
 * route were hand-rolling it because they could not reach it here. Re-exported
 * so the missions code keeps importing it from where it always did.
 */
export type { RewardLike } from '../../../components/page/rarity'
export {
  accentByRarity,
  gradedTypes,
  isNoisyReward,
  rarityStyle,
  rewardGrade,
  rewardMeta,
} from '../../../components/page/rarity'

const missionLabels: Partial<Record<keyof typeof zonesCategories, string>> = {
  atlas: 'Fight the Storm',
  'atlas-c2': 'Fight Category 2 Storm',
  'atlas-c3': 'Fight Category 3 Storm',
  'atlas-c4': 'Fight Category 4 Storm',
  dtb: 'Deliver the Bomb',
  dte: 'Destroy the Encampments',
  eac: 'Eliminate and Collect',
  ets: 'Evacuate the Shelter',
  htm: 'Haunt the Titan',
  htr: 'Hit the Road',
  'mini-boss': 'Storm King',
  ptp: 'Protect the Presents',
  quest: 'Quest Mission',
  radar: 'Build the Radar Grid',
  refuel: 'Refuel the Homebase',
  rescue: 'Rescue the Survivors',
  resupply: 'Resupply',
  rocket: 'Launch the Rocket',
  rtd: 'Retrieve the Data',
  rtl: 'Ride the Lightning',
  rts: 'Repair the Shelter',
  stn: 'Survive the Night',
  'storm-shield': 'Storm Shield',
  tts: 'Trap the Storm',
}

/**
 * `mission.zone.type.id` is a category KEY (`'rtl'`, `'atlas-c3'`, `'rescue'`),
 * not one of the generator patterns held in that category's value array, so
 * this is a direct lookup. Scanning the values for the key matches nothing.
 */
export function missionTypeLabel(id: string) {
  if (id === 'unknown') {
    return null
  }

  return missionLabels[id as keyof typeof zonesCategories] ?? null
}

export function stripColon(value: string) {
  // The CJK locales end these labels with a full-width colon, not an ASCII one.
  return value.replace(/\s*[:：]\s*$/, '')
}

export function resolveBrief(
  data: WorldInfoMission,
  featured?: RewardLike
) {
  const alertRewards: Array<RewardLike> = data.ui.alert.rewards.filter(
    (reward) => !isNoisyReward(reward.itemId)
  )
  const baseRewards: Array<RewardLike> = data.ui.mission.rewards.filter(
    (reward) => !isNoisyReward(reward.itemId)
  )
  const payload =
    featured ??
    alertRewards[0] ??
    [...baseRewards].sort((left, right) => right.quantity - left.quantity)[0] ??
    null
  const payloadIsAlert = Boolean(
    payload && alertRewards.some((reward) => reward.itemId === payload.itemId)
  )

  return {
    /**
     * Alert rewards the bay isn't showing, as a `+N`. They are deliberately
     * NOT repeated in the meta strip: the same fact twice on one 64px row is
     * the redundancy this row shape exists to remove.
     */
    extraAlertCount: payloadIsAlert
      ? Math.max(0, alertRewards.length - 1)
      : alertRewards.length,
    meta: baseRewards
      .filter((reward) => reward.itemId !== payload?.itemId)
      .slice(0, 4),
    payload,
    payloadIsAlert,
  }
}
