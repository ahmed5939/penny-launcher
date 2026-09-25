import { cn } from '../../lib/utils'

/**
 * A thin completion bar.
 *
 * Progress used to be printed as "3/7" in the corner of a row, which is a
 * number you have to do arithmetic on before it means anything. The bar reads
 * at a glance and the count stays for the exact value.
 */
export function ProgressBar({
  className,
  color,
  label,
  total,
  value,
}: {
  className?: string
  /**
   * A named palette colour (a F.O.R.T. stat, a rarity) when the bar is a
   * measure of that thing rather than completion. Replaces the done/doing
   * primary–success pair.
   */
  color?: string
  /** Accessible name, when the bar has no visible label beside it. */
  label?: string
  total: number
  value: number
}) {
  const safeTotal = total > 0 ? total : 0
  const percent =
    safeTotal <= 0 ? 0 : Math.min(100, Math.round((value / safeTotal) * 100))
  const complete = safeTotal > 0 && value >= safeTotal

  return (
    <div
      role="progressbar"
      aria-valuemax={safeTotal}
      aria-valuemin={0}
      aria-label={label}
      aria-valuenow={value}
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full bg-muted/70',
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300',
          !color && (complete ? 'bg-success' : 'bg-primary')
        )}
        style={{ background: color, width: `${percent}%` }}
      />
    </div>
  )
}
