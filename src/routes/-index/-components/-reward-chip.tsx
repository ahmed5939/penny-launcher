/*
 * The reward components moved to the page kit — `-live-mission`, `item-detail`
 * and `history` all needed them and could not import out of a route. Kept as a
 * shim so the missions code keeps importing them from where it always did.
 */
export type { RewardLike } from './-mission-data'
export {
  RewardLine,
  RewardPayload,
  RewardWell,
  type RewardWellSize,
} from '../../../components/page/reward'
