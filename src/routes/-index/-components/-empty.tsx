import { Inbox, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PropsWithChildren } from 'react'

import { defaultEmptyMessage, getRandomEmptyMessage } from './-constants'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { cn } from '../../../lib/utils'

/**
 * Nothing survived the filters, or nobody is logged in.
 *
 * A quiet fill with the reason in it — no outline, no icon well — so an
 * empty zone reads as a pause in the list rather than a broken card.
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
        'flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 px-6 py-8 text-center',
        className
      )}
    >
      <SearchX className="size-5 text-muted-foreground/60" />
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-muted/20 px-6 py-8 text-center">
      {/*
        The joke's image sits above the text rather than trailing it inline,
        so a long quote wraps without dragging the icon around.
      */}
      {message?.icon ? (
        <img
          src={message.icon}
          alt=""
          className="size-7 object-contain"
          loading="lazy"
        />
      ) : (
        <Inbox className="size-5 text-muted-foreground/60" />
      )}
      <p className="max-w-[26rem] text-sm text-muted-foreground">
        {messageText}
      </p>
      {isVBucks && message?.author && (
        <p className="micro-label">一 {message.author}</p>
      )}
    </div>
  )
}
