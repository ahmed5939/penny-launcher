import { cn } from '../../lib/utils'

/**
 * Console/store marks for linked accounts.
 *
 * Inline SVG rather than image files: the CSP forbids remote assets, and a
 * two-letter text prefix ("xbl:", "psn:") read as debug output next to real
 * names. Single-path glyphs so they take `currentColor` and stay legible at
 * the sizes a list row allows.
 */

export type PlatformKey = 'psn' | 'xbl' | 'nintendo' | 'steam' | 'epic'

const paths: Record<PlatformKey, string> = {
  // PlayStation "PS" monogram.
  psn: 'M8.98 2.6v16.36l3.7 1.18V6.63c0-.62.28-1.03.72-.89.58.16.7.73.7 1.35v5.11c2.3 1.12 4.12-.01 4.12-2.94 0-3.01-1.06-4.35-4.18-5.42-1.23-.42-3.48-1.12-5.06-1.24zM14.2 17.4l5.95-2.13c.68-.24.78-.59.23-.77-.55-.18-1.54-.13-2.22.12l-3.96 1.4v-2.23l.23-.08s1.14-.4 2.75-.58c1.6-.18 3.57.02 5.11.61 1.74.55 1.94 1.36 1.5 1.92-.44.55-1.52.95-1.52.95l-8.07 2.9V17.4zM3.3 17.23c-1.78-.5-2.08-1.55-1.27-2.16.75-.55 2.03-.97 2.03-.97l5.27-1.87v2.14l-3.8 1.36c-.67.24-.77.58-.22.76.55.19 1.54.13 2.21-.11l1.81-.66v1.91l-.36.06c-1.82.3-3.76.17-5.67-.46z',
  /*
   * Xbox sphere: the four body segments, leaving the "X" as negative space.
   * The previous hand-drawn approximation filled the disc and cut a lopsided
   * X out of it, which rendered inverted with a stray sliver at the top.
   */
  xbl: 'M4.102 21.033A11.947 11.947 0 0 0 12 24a11.96 11.96 0 0 0 7.902-2.967c1.877-1.912-4.316-8.709-7.902-11.417-3.582 2.708-9.779 9.505-7.898 11.417zm11.16-14.406c2.5 2.961 7.484 10.313 6.076 12.912A11.942 11.942 0 0 0 24 12.004a11.95 11.95 0 0 0-3.57-8.536s-.027-.022-.082-.042a.824.824 0 0 0-.281-.045c-.594 0-1.964.606-4.805 3.246zM3.654 3.426c-.057.02-.082.041-.086.042A11.956 11.956 0 0 0 0 12.004c0 2.854.998 5.473 2.661 7.533-1.401-2.605 3.579-9.951 6.08-12.91-2.847-2.641-4.216-3.245-4.806-3.245a.671.671 0 0 0-.281.046v-.002zM12.002 0c-1.984 0-3.83.481-5.418 1.331.023 0 2.16-.457 5.418 2.286C15.256.874 17.394 1.33 17.417 1.33A11.62 11.62 0 0 0 12.002 0z',
  // Switch: the two Joy-Con halves, drawn as one path.
  nintendo:
    'M10.5 2H6.4A4.4 4.4 0 0 0 2 6.4v11.2A4.4 4.4 0 0 0 6.4 22h4.1V2zm-2 5.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM13.5 2v20h4.1a4.4 4.4 0 0 0 4.4-4.4V6.4A4.4 4.4 0 0 0 17.6 2h-4.1zm2.7 12.1a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z',
  // Steam.
  steam:
    'M11.98 2C6.5 2 2.02 6.2 1.6 11.56l5.6 2.32a3.4 3.4 0 0 1 1.9-.6h.17l2.5-3.62v-.05a4.53 4.53 0 1 1 4.53 4.53h-.1l-3.56 2.54v.14a3.4 3.4 0 0 1-6.75.54l-4-1.66A10.01 10.01 0 0 0 11.98 22c5.52 0 10-4.48 10-10s-4.48-10-10-10zm-3.7 15.16.02.01a2.6 2.6 0 0 0 3.4-3.9l-1.3-.54a2.6 2.6 0 0 1-2.12 4.43zm7.98-8.66a3.02 3.02 0 1 0 0 6.04 3.02 3.02 0 0 0 0-6.04zm0 .75a2.27 2.27 0 1 1 0 4.54 2.27 2.27 0 0 1 0-4.54z',
  // Epic Games.
  epic: 'M4.2 2h15.6c.9 0 1.4.5 1.4 1.4v12.3c0 .5-.1.7-.5 1L12.6 22c-.3.2-.5.3-.7.3s-.4-.1-.7-.3L3.1 16.7c-.4-.3-.5-.5-.5-1V3.4C2.6 2.5 3.1 2 4.2 2zm4 4.7v10.6h7.6v-2h-5.3v-2.4h4.2v-2h-4.2V8.7h5.2v-2H8.2z',
}

const labels: Record<PlatformKey, string> = {
  psn: 'PlayStation Network',
  xbl: 'Xbox Live',
  nintendo: 'Nintendo Switch',
  steam: 'Steam',
  epic: 'Epic Games',
}

/** Epic's key for a platform isn't always our key. */
function normalise(platform: string): PlatformKey | null {
  const value = platform.toLowerCase()

  if (value.startsWith('psn') || value === 'playstation') return 'psn'
  if (value.startsWith('xbl') || value === 'xbox') return 'xbl'
  if (value.startsWith('nintendo') || value === 'nsw') return 'nintendo'
  if (value.startsWith('steam')) return 'steam'
  if (value.startsWith('epic')) return 'epic'

  return null
}

export function PlatformIcon({
  className,
  platform,
}: {
  className?: string
  platform: string
}) {
  const key = normalise(platform)

  if (!key) {
    return (
      <span
        /*
         * The caption rank, not a size of its own: a three-letter platform
         * abbreviation is a label, and the app has exactly two label ranks.
         */
        className={cn('micro-label', className)}
        title={platform}
      >
        {platform.slice(0, 3)}
      </span>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-4 shrink-0', className)}
      fill="currentColor"
      role="img"
      aria-label={labels[key]}
    >
      <title>{labels[key]}</title>
      <path d={paths[key]} />
    </svg>
  )
}
