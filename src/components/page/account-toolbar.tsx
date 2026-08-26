import type { ReactNode } from 'react'
import type { AccountData } from '../../types/accounts'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * "Which account am I looking at, and what can I do to it."
 *
 * Thirteen screens opened with the same row — the display name on the left, a
 * Refresh on the right — and thirteen spelt it slightly differently. It is the
 * most duplicated shape in the app, so it is one component now.
 *
 * Deliberately just the row, not a `Panel` around it: some screens want it as
 * a panel of its own, some want it as the first line of a panel that has more
 * below it, and wrapping it here would only make half of them fight the
 * wrapper back off.
 */
export function AccountToolbar({
  account,
  actions,
  className,
}: {
  account: AccountData | null | undefined
  /** Buttons acting on this account — Refresh, Open, Export. */
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
        {parseCustomDisplayName(account)}
      </span>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
