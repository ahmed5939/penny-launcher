import { Inbox, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PropsWithChildren } from 'react'

import { defaultEmptyMessage, defaultEmptyVBucksMessage } from './-constants'
import { EmptyState } from '../../../components/page'
import { usePrimaryAccount } from '../../../hooks/accounts/scope'

import { cn } from '../../../lib/utils'

/**
 * Nothing survived the filters, or nobody is logged in.
 *
 * A quiet fill with the reason in it, so an empty zone reads as a pause in
 * the list rather than a broken card.
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
    <EmptyState
      className={cn('bg-muted/20 py-8', className)}
      icon={SearchX}
      title={messageText}
    />
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

  const messageText = isVBucks
    ? t(defaultEmptyVBucksMessage)
    : title ?? t(defaultEmptyMessage)

  return (
    <EmptyState
      className="bg-muted/20 py-8"
      icon={Inbox}
      title={messageText}
    />
  )
}
