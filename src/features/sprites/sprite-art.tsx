import { Ghost } from 'lucide-react'

import { raritiesColor } from '../../config/constants/resources'
import { rarityTypeFromName } from '../../components/page'
import { spriteIconUrl } from '../../sprite-images'

import { cn } from '../../lib/utils'

/**
 * A sprite's own picture, at list size.
 *
 * The art carries the identity, so it stands on its own with no tile or
 * frame behind it; rarity is a short bar of the game's rarity colour under
 * it, the same palette every item in the app uses. A sprite the bundled data
 * has no picture for gets a faint glyph in its place rather than a hole.
 */
export function SpriteArt({
  className,
  dim = false,
  iconFile,
  rarity,
  size = 'md',
}: {
  className?: string
  /** Never secured: drawn faded so owned art stands out beside it. */
  dim?: boolean
  iconFile: string | null
  rarity?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const url = spriteIconUrl(iconFile)
  const colour = rarityColour(rarity)
  const box = { sm: 'size-7', md: 'size-10', lg: 'size-14' }[size]

  return (
    <span
      aria-hidden
      className={cn('relative inline-grid shrink-0 place-items-center', box, className)}
    >
      {url ? (
        <img
          alt=""
          className={cn(
            'size-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]',
            dim && 'opacity-40 grayscale'
          )}
          decoding="async"
          draggable={false}
          loading="lazy"
          src={url}
        />
      ) : (
        <Ghost className="size-1/2 text-muted-foreground/50" />
      )}
      {colour && (
        <span
          className="absolute -bottom-0.5 left-1/2 h-0.5 w-1/2 -translate-x-1/2 rounded-full"
          style={{ background: colour }}
        />
      )}
    </span>
  )
}

/** The game's colour for a sprite rarity word ("legendary"), from config. */
export function rarityColour(rarity: string | null | undefined) {
  const type = rarityTypeFromName(rarity)

  return type ? raritiesColor[type] : null
}

/** "Gold Water"; just "Water" for the base treatment. */
export function spriteName(familyName: string, variant: string, label: string) {
  return variant === 'base' ? familyName : `${label} ${familyName}`
}
