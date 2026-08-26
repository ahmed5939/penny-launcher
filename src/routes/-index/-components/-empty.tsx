import { Inbox, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PropsWithChildren } from 'react'

import { defaultEmptyMessage, getRandomEmptyMessage } from './-constants'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { cn } from '../../../lib/utils'

/**
 * Nothing survived the filters, or nobody is logged in.
 *
 * A deliberately unfilled brief card: same radius and border weight as a row,
 * dashed so the edge says "nothing here" instead of reading as a row that
 * failed to render.
 */
export function EmptyResults({
  children,
  className,
  total,
}: PropsWithChildren<{
  className?: string
  total: number
}>) {
  const { t } = useTranslation(['alerts'])
  const account = usePrimaryAccount()

  if (total > 0) {
    return children
  }

  const messageText = t(
    account ? 'results.empty.missions' : 'results.empty.login-required'
  )

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center',
        className
      )}
    >
      <span className="grid size-10 place-items-center rounded-full bg-muted/40 ring-1 ring-inset ring-border/60">
        <SearchX className="size-4 text-muted-foreground/60" />
      </span>
      <p className="max-w-[26rem] text-sm text-muted-foreground">
        {messageText}
      </p>
    </div>
  )
}

export function EmptySection({
  children,
  isVBucks,
  title,
  total,
}: PropsWithChildren<{
  isVBucks?: boolean
  title?: string
  total: number
}>) {
  const { t } = useTranslation(['alerts'], {
    keyPrefix: 'results.empty',
  })

  if (total > 0) {
    return children
  }

  /*
   * `getRandomEmptyMessage` returns null unless this is the V-Bucks section, so
   * the joke, its icon and its attribution are all naturally scoped to it.
   */
  const message = getRandomEmptyMessage(isVBucks)
  const isDefault = message?.isDefault ?? false
  const messageText =
    isVBucks && message
      ? isDefault
        ? t(message.text)
        : message.text
      : title ?? t(defaultEmptyMessage.text)

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-10 text-center">
      {/*
        The joke's image sits in the well above the text rather than trailing
        it inline, so a long quote wraps without dragging the icon around.
      */}
      <span className="grid size-10 place-items-center rounded-full bg-muted/40 ring-1 ring-inset ring-border/60">
        {message?.icon ? (
          <img
            src={message.icon}
            alt=""
            className="size-5 object-contain"
            loading="lazy"
          />
        ) : (
          <Inbox className="size-4 text-muted-foreground/60" />
        )}
      </span>
      <p className="max-w-[26rem] text-sm text-muted-foreground">
        {messageText}
      </p>
      {isVBucks && message?.author && (
        <p className="micro-label">一 {message.author}</p>
      )}
    </div>
  )
}
