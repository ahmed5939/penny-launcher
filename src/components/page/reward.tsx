import type { RewardLike } from './rarity'

import { useTranslation } from 'react-i18next'

import { rarityStyle, rewardGrade } from './rarity'

import { numberWithCommaSeparator } from '../../lib/parsers/numbers'
import { cn } from '../../lib/utils'

export type RewardWellSize = 'sm' | 'lg'

/**
 * The square every reward is shown in. Two sizes and no third: 32px in a list,
 * 44px in a mission row's payload bay.
 *
 * Rarity is a ring, never a swatch image and never a coloured fill behind the
 * icon — and only for the grades `rewardGrade` decided are worth colour, so a
 * page of resources stays grey. The ring reads off `--rarity-soft`, which
 * `rarityStyle` sets on this element, because Tailwind's `/35` opacity
 * modifier cannot compose with an arbitrary custom property.
 */
export function RewardWell({
  className,
  isAlert,
  reward,
  size,
}: {
  className?: string
  /**
   * Mission-alert reward rather than a base reward. Only a fallback signal —
   * the bay tint and the section heading are what actually say "alert".
   */
  isAlert?: boolean
  reward: RewardLike
  size: RewardWellSize
}) {
  const grade = rewardGrade(reward)
  const large = size === 'lg'

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-lg bg-background/60 ring-1 ring-inset',
        large ? 'size-11' : 'size-8',
        grade.accent ? 'ring-[color:var(--rarity-soft)]' : 'ring-border/60',
        isAlert && !grade.accent && 'ring-primary/30',
        reward.isBad && 'ring-destructive/60',
        className
      )}
      style={rarityStyle(grade.accent)}
      title={grade.name || undefined}
    >
      <img
        src={reward.imageUrl}
        alt=""
        className={cn('object-contain', large ? 'size-8' : 'size-6')}
        loading="lazy"
      />
    </span>
  )
}

/**
 * The payload bay's contents: the one reward a mission row exists to advertise.
 *
 * The 44px well next to a 20px figure is roughly four times the visual mass of
 * anything else in the row, which is the whole point of the direction — a
 * long name truncates, the well never shrinks to make room for it.
 *
 * A quantity of 1 is not printed. "1 Legendary Survivor" is a name with a
 * redundant number in front of it.
 */
export function RewardPayload({
  extraCount = 0,
  isBanked,
  reward,
}: {
  /** `resolveBrief().extraAlertCount` — the alert rewards this bay isn't showing. */
  extraCount?: number
  /** The mission is already completed on the primary account. */
  isBanked?: boolean
  reward: RewardLike
}) {
  const grade = rewardGrade(reward)

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2.5">
      <RewardWell
        className={cn(isBanked && 'opacity-80')}
        reward={reward}
        size="lg"
      />

      {/*
        Compact: the bay keeps its well and its number and drops the words.
        A name and a rarity caption both cut to three letters say less than
        the well's own rarity ring already does, and the width they cost is
        the width the mission's title needs to survive at all.
      */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        {reward.quantity > 1 && (
          <span className="figure truncate text-xl font-bold leading-none text-foreground compact:text-lg compact:leading-none">
            {numberWithCommaSeparator(reward.quantity)}
          </span>
        )}
        {grade.name && (
          <span
            className="truncate text-[0.75rem] font-medium leading-tight text-foreground/85 compact:hidden"
            title={grade.name}
          >
            {grade.name}
          </span>
        )}
        {grade.word && (
          <span
            className="truncate text-[0.625rem] font-semibold uppercase leading-none tracking-[0.1em] text-[color:var(--rarity)] compact:hidden"
            style={rarityStyle(grade.accent)}
          >
            {grade.word}
          </span>
        )}
      </span>

      {extraCount > 0 && (
        <span className="figure shrink-0 rounded bg-background/60 px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground ring-1 ring-inset ring-border/60">
          +{extraCount}
        </span>
      )}
    </span>
  )
}

/**
 * A reward as a list row: name on the left, number on the right.
 *
 * Stacked in a `<ul>` the quantities form a rail down the right edge, so a
 * ranking becomes a shape you can see rather than six numbers you have to
 * read. Renders an `<li>`, so it always needs a list around it.
 */
export function RewardLine({
  className,
  isAlert,
  isBad,
  reward,
}: {
  className?: string
  isAlert?: boolean
  /** A bad Twine Peaks roll: the MID caption plus a destructive figure. */
  isBad?: boolean
  reward: RewardLike
}) {
  const { t } = useTranslation(['alerts'])
  const grade = rewardGrade(reward)

  return (
    <li className={cn('flex items-center gap-3 py-2', className)}>
      <RewardWell
        isAlert={isAlert}
        reward={{ ...reward, isBad }}
        size="sm"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium leading-tight text-foreground/90">
          {grade.name || reward.itemId}
        </span>
        {grade.word && (
          <span
            className="mt-0.5 block text-[0.625rem] font-semibold uppercase leading-none tracking-[0.08em] text-[color:var(--rarity)]"
            style={rarityStyle(grade.accent)}
          >
            {grade.word}
          </span>
        )}
        {isBad && (
          <span className="mt-0.5 block text-[0.625rem] font-semibold uppercase leading-none tracking-[0.06em] text-destructive">
            {t('sections.twine-peaks.mid')}
          </span>
        )}
      </span>

      <span
        className={cn(
          'figure shrink-0 text-sm font-bold',
          isBad ? 'text-destructive' : 'text-foreground/90'
        )}
      >
        {numberWithCommaSeparator(reward.quantity)}
      </span>
    </li>
  )
}
