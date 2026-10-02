import { Link } from '@tanstack/react-router'
import { KeyRound, Link2, MailCheck, MailWarning } from 'lucide-react'

import { Callout } from '../../components/page'

import { useGetAccounts } from '../../hooks/accounts'
import { useAccountSecurity } from '../../state/accounts/security'

import { securityIssues } from './model'

import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * Account security under an account's name: quiet when it is fine, and a
 * callout when two-factor is off — the one setting that stops Fortnite
 * gifting and Save the World trading.
 */

/** "Two-factor on · Email verified · PlayStation, Xbox linked" — plus other accounts missing two-factor. */
export function AccountSecurityLine({ accountId }: { accountId: string }) {
  const { accounts } = useAccountSecurity()
  const { accountList, idsList } = useGetAccounts()
  const entry = accounts[accountId]

  if (!entry || entry.status !== 'ok') {
    return null
  }

  const withoutTfa = idsList.filter(
    (id) => id !== accountId && accounts[id]?.status === 'ok' && accounts[id]?.tfaEnabled === false
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {entry.tfaEnabled !== null && (
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className={cn('size-3.5 shrink-0', entry.tfaEnabled ? 'text-success' : 'text-warning')} />
          <span className={cn(entry.tfaEnabled ? 'text-foreground/80' : 'font-medium text-warning')}>
            {entry.tfaEnabled ? 'Two-factor on' : 'Two-factor off'}
          </span>
        </span>
      )}
      {entry.emailVerified !== null && (
        <span className="inline-flex items-center gap-1.5">
          {entry.emailVerified ? (
            <MailCheck className="size-3.5 shrink-0" />
          ) : (
            <MailWarning className="size-3.5 shrink-0 text-warning" />
          )}
          <span className={cn(!entry.emailVerified && 'text-warning')}>
            {entry.emailVerified ? 'Email verified' : 'Email not verified'}
          </span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <Link2 className="size-3.5 shrink-0" />
        {entry.platforms.length > 0
          ? `${entry.platforms.map((platform) => platform.label).join(', ')} linked`
          : 'No platforms linked'}
      </span>
      {withoutTfa.map((id) => (
        <span key={id}>
          · <span className="text-foreground/80">{parseCustomDisplayName(accountList[id])}</span>:{' '}
          <span className="text-warning">two-factor off</span>
        </span>
      ))}
    </div>
  )
}

/** Only when something needs doing: two-factor off, a cabined account, an unverified email. */
export function AccountSecurityCallout({ accountId }: { accountId: string }) {
  const { accounts } = useAccountSecurity()
  const [issue] = securityIssues(accounts[accountId])

  if (!issue) {
    return null
  }

  const settings = (
    <Link className="font-medium text-primary hover:underline" to="/account-management/epic-games-settings">
      Open Epic account settings →
    </Link>
  )

  if (issue === 'tfa') {
    return (
      <Callout title="Two-factor authentication is off" tone="warning">
        <p>Fortnite won't let this account gift items or trade in Save the World until it's on. {settings}</p>
      </Callout>
    )
  }

  if (issue === 'cabined') {
    return (
      <Callout title="Epic has restricted this account" tone="warning">
        <p>It's in cabined mode until a parent or guardian gives consent.</p>
      </Callout>
    )
  }

  return (
    <Callout title="Email not verified" tone="info">
      <p>Verify it to keep this account recoverable. {settings}</p>
    </Callout>
  )
}
