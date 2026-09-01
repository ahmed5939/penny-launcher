import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, HeartPulse, RotateCw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { EmptyState, PageHeader } from '../../../components/page'

import {
  useGetAccounts,
  useGetSelectedAccount,
} from '../../../hooks/accounts'

import { pennyDBProfileUrl } from '../../../services/endpoints/pennydb'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={HeartPulse}
        section={t('account-management.title')}
        title={t('account-management.options.profile')}
        description="Your public PennyDB profile, rendered in place — search any Epic display name to look other commanders up."
      />
      <Content />
    </>
  )
}

function Content() {
  const { accountsArray } = useGetAccounts()
  const { selected } = useGetSelectedAccount()

  /** The Epic display name whose profile is on screen right now. */
  const [viewedName, setViewedName] = useState(selected?.displayName ?? '')
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  /** Bumped to force a fresh load of the same profile. */
  const [reloadKey, setReloadKey] = useState(0)

  const showProfile = (displayName: string) => {
    const name = displayName.trim()

    if (name.length === 0) {
      return
    }

    setIsLoading(true)
    setViewedName(name)
    setReloadKey((current) => current + 1)
  }

  /** Follow the titlebar picker until the user searches someone else. */
  useEffect(() => {
    if (selected?.displayName) {
      showProfile(selected.displayName)
    }
  }, [selected?.accountId])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    showProfile(searchValue)
    setSearchValue('')
  }

  if (!viewedName) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="Select an account to view its profile"
        description="Pick an account in the titlebar, or search any Epic display name below."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="relative w-full max-w-72"
          onSubmit={handleSearch}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search any Epic display name…"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        </form>

        {accountsArray.map((account) => (
          <button
            className={cn(
              'rounded-full border px-2.5 py-1 text-[0.7rem] font-medium transition-colors',
              account.displayName === viewedName
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
            key={account.accountId}
            type="button"
            onClick={() => showProfile(account.displayName)}
          >
            {parseCustomDisplayName(account)}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            title="Reload profile"
            onClick={() => showProfile(viewedName)}
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              window.electronAPI.openExternalURL(pennyDBProfileUrl(viewedName))
            }
          >
            <ExternalLink className="size-3.5" />
            Open in browser
          </Button>
        </div>
      </div>

      <iframe
        className="h-[calc(100dvh-16rem)] min-h-[420px] w-full rounded-xl border border-border/60 bg-card/40"
        key={`${viewedName}-${reloadKey}`}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        src={pennyDBProfileUrl(viewedName)}
        title={`PennyDB profile for ${viewedName}`}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  )
}
