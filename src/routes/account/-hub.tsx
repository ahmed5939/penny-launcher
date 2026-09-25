import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import {
  ChevronRight,
  Coins,
  Cog,
  Contact,
  FileText,
  Ghost,
  Gift,
  History,
  KeyRound,
  Shirt,
  Ticket,
  Trash2,
  UserPlus,
} from 'lucide-react'

import { Panel, PanelHeader } from '../../components/page'

import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'

import { spriteIconUrl } from '../../sprite-images'
import { assets } from '../../lib/repository'
import { cn, parseCustomDisplayName } from '../../lib/utils'

/**
 * The Epic account hub.
 *
 * What the account *has* comes first — its wallet, locker, sprites, friends
 * and gifts, each as a card led by the game's own art where there is any.
 * Linking, codes and settings are the fine print, so they sit underneath as
 * one list of plain rows rather than another grid of equal-weight tiles.
 */

type Destination = {
  title: string
  description: string
  to: string
  params?: Record<string, string>
}

type Feature = Destination & {
  /** The game's art for the thing, when the app ships some. */
  art?: string | null
  icon: LucideIcon
}

type Utility = Destination & {
  icon: LucideIcon
  danger?: boolean
}

const features: Array<Feature> = [
  {
    title: 'V-Bucks',
    description: 'Balance, sources and purchases',
    art: assets('currency_mtxswap'),
    icon: Coins,
    to: '/account-management/vbucks-information',
  },
  {
    title: 'BR Locker',
    description: 'Loadout, collection and sidekicks',
    icon: Shirt,
    to: '/account-management/locker',
  },
  {
    title: 'Sprites',
    description: 'Owned, lost and missing treatments',
    art: spriteIconUrl('airsprite_gold.webp'),
    icon: Ghost,
    to: '/account-management/sprites',
  },
  {
    title: 'Friends',
    description: 'Requests, invites and the block list',
    icon: Contact,
    to: '/account-management/friends',
  },
  {
    title: 'Gifts',
    description: 'Every cosmetic gifted to you, and by whom',
    icon: Gift,
    to: '/account-management/gifts-information',
  },
  {
    title: 'Quest history',
    description: 'Quests this account has completed',
    icon: History,
    to: '/account-management/history',
  },
]

const utilities: Array<Utility> = [
  {
    title: 'Add account',
    description: 'Quick login, authorization code, exchange code, device auth or Aerial',
    icon: UserPlus,
    to: '/accounts/add/$type',
    params: { type: 'quick-login' },
  },
  {
    title: 'Redeem codes',
    description: 'On one or more accounts at once',
    icon: Ticket,
    to: '/account-management/redeem-codes',
  },
  {
    title: 'Exchange code',
    description: 'Sign another app in as the selected account',
    icon: KeyRound,
    to: '/accounts/add/$type',
    params: { type: 'exchange-code' },
  },
  {
    title: 'Epic account settings',
    description: 'Open epicgames.com already signed in',
    icon: Cog,
    to: '/account-management/epic-games-settings',
  },
  {
    title: 'EULA',
    description: 'Check which accounts still need to accept it',
    icon: FileText,
    to: '/account-management/eula',
  },
  {
    title: 'Remove account',
    description: 'Unlink it from Penny',
    icon: Trash2,
    to: '/accounts/remove',
    danger: true,
  },
]

export function AccountHub() {
  return (
    <div className="space-y-6">
      <SignedInLine />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title}>
            <FeatureCard feature={feature} />
          </li>
        ))}
      </ul>

      <Panel>
        <PanelHeader
          compact
          title="Accounts and settings"
        />
        <ul className="grid divide-y divide-border/40 lg:grid-cols-2 lg:divide-y-0">
          {utilities.map((utility) => (
            <li
              className="lg:border-b lg:border-border/40 lg:odd:border-r lg:[&:nth-last-child(-n+2)]:border-b-0"
              key={utility.title}
            >
              <UtilityRow utility={utility} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

/** Who the hub is about — the account the title bar has selected. */
function SignedInLine() {
  const { selected } = useGetSelectedAccount()
  const { accountsArray } = useGetAccounts()
  const total = accountsArray.length

  if (!selected) {
    return (
      <p className="text-ui text-muted-foreground">
        No account linked yet.{' '}
        <Link
          className="font-medium text-primary hover:underline"
          params={{ type: 'authorization-code' }}
          to="/accounts/add/$type"
        >
          Add one →
        </Link>
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="text-display-sm font-bold leading-none">
        {parseCustomDisplayName(selected)}
      </span>
      <span className="text-ui text-muted-foreground">
        Selected in the title bar
        {total > 1 && (
          <>
            {' · '}
            <span className="figure">{total}</span> accounts linked
          </>
        )}
      </span>
    </div>
  )
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <Link
      className="panel-interactive group flex h-full items-center gap-4 px-4 py-4"
      params={feature.params}
      to={feature.to}
    >
      {feature.art ? (
        <img
          alt=""
          className="size-14 shrink-0 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.35)] transition-transform group-hover:scale-105"
          decoding="async"
          loading="lazy"
          src={feature.art}
        />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center text-muted-foreground transition-colors group-hover:text-primary">
          <feature.icon className="size-7" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-title font-semibold leading-tight">
          {feature.title}
        </span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
          {feature.description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}

function UtilityRow({ utility }: { utility: Utility }) {
  return (
    <Link
      className={cn(
        'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/30',
        utility.danger && 'hover:bg-destructive/[0.07]'
      )}
      params={utility.params}
      to={utility.to}
    >
      <utility.icon
        className={cn(
          'size-4 shrink-0 text-muted-foreground',
          utility.danger && 'group-hover:text-destructive'
        )}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-ui font-medium',
            utility.danger && 'group-hover:text-destructive'
          )}
        >
          {utility.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {utility.description}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
    </Link>
  )
}
