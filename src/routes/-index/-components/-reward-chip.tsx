import { cn } from '../../../lib/utils'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { assets } from '../../../lib/repository'

/** Trap/weapon rarities, lowest to highest. */
const rarityRing: Record<string, string> = {
  common: 'ring-zinc-400/40',
  uncommon: 'ring-green-500/50',
  rare: 'ring-sky-500/50',
  epic: 'ring-purple-500/50',
  legendary: 'ring-orange-500/50',
  mythic: 'ring-yellow-400/60',
}

export type RewardLike = {
  imageUrl: string
  itemId?: string
  quantity: number
  rarity?: string | null
  /** Resource classification; `null` for rewards that have none. */
  type?: string | null
}

/**
 * One reward, everywhere.
 *
 * Rewards used to render differently in the mission cards and in the totals
 * panel — different icon sizes, different quantity placement, rarity shown
 * in one and not the other. A single chip keeps them comparable, and gives
 * the icon enough room to actually be identifiable.
 */
export function RewardChip({
  className,
  isAlert,
  reward,
  size = 'default',
}: {
  className?: string
  /** Mission-alert reward rather than a base reward. */
  isAlert?: boolean
  reward: RewardLike
  size?: 'default' | 'large'
}) {
  const ring = reward.rarity ? rarityRing[reward.rarity] : undefined
  const large = size === 'large'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/50 pr-2',
        large ? 'py-1 pl-1' : 'py-0.5 pl-0.5',
        className
      )}
      title={reward.rarity ? `${reward.rarity} · ${reward.type ?? ''}` : undefined}
    >
      <span
        className={cn(
          'relative grid shrink-0 place-items-center rounded bg-muted/50',
          large ? 'size-8' : 'size-6',
          ring && `ring-1 ring-inset ${ring}`
        )}
      >
        <img
          src={reward.imageUrl}
          alt=""
          className={cn('object-contain', large ? 'size-7' : 'size-5')}
          loading="lazy"
        />
        {isAlert && (
          <img
            src={assets('alert')}
            alt=""
            className="absolute -left-1 -top-1 size-3"
          />
        )}
      </span>

      <span
        className={cn(
          'font-semibold tabular-nums',
          large ? 'text-sm' : 'text-xs'
        )}
      >
        {numberWithCommaSeparator(reward.quantity)}
      </span>
    </span>
  )
}
