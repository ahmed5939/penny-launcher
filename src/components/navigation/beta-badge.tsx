import { Chip } from '../page'

/**
 * Marks a tool that is new and still settling.
 *
 * Beta tools sit in their natural section rather than a quarantine menu —
 * they are meant to be used — but the badge sets the expectation that the
 * behaviour may still move under you.
 *
 * It is a `Chip` and nothing more: a one-word qualifier attached to a name is
 * exactly what a chip is for, and the accent tone is the app's one way of
 * saying "this is about the product, not about your data".
 */
export function BetaBadge({ className }: { className?: string }) {
  return (
    <Chip
      className={className}
      tone="accent"
    >
      Beta
    </Chip>
  )
}
