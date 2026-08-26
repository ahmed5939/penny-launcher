import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import {
  Coins,
  Cog,
  FileText,
  KeyRound,
  Smartphone,
  Ticket,
  Trash2,
  UserPlus,
} from 'lucide-react'


/**
 * Epic account hub: everything that belongs to the Epic account (not to
 * Fortnite the game) in one launcher-style grid — shown under the "Account"
 * tab of the detail view.
 */

type HubItem = {
  title: string
  description: string
  icon: LucideIcon
  to: string
  params?: Record<string, string>
}

const items: Array<HubItem> = [
  {
    title: 'Add account',
    description: 'Link an Epic account — all sign-in methods in one place',
    icon: UserPlus,
    to: '/accounts/add/$type',
    params: { type: 'authorization-code' },
  },
  {
    title: 'Devices auth',
    description: 'Manage devices linked to the account',
    icon: Smartphone,
    to: '/account-management/devices-auth',
  },
  {
    title: 'V-Bucks information',
    description: 'Balance across all your accounts',
    icon: Coins,
    to: '/account-management/vbucks-information',
  },
  {
    title: 'Redeem codes',
    description: 'Redeem codes on one or more accounts',
    icon: Ticket,
    to: '/account-management/redeem-codes',
  },
  {
    title: 'Epic Games settings',
    description: 'Open the account settings on epicgames.com',
    icon: Cog,
    to: '/account-management/epic-games-settings',
  },
  {
    title: 'EULA',
    description: 'Check EULA verification status',
    icon: FileText,
    to: '/account-management/eula',
  },
  {
    title: 'Generate exchange code',
    description: 'Create an exchange code for the selected account',
    icon: KeyRound,
    to: '/accounts/add/$type',
    params: { type: 'exchange-code' },
  },
  {
    title: 'Remove account',
    description: 'Unlink an account from the launcher',
    icon: Trash2,
    to: '/accounts/remove',
  },
]

export function AccountHub() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title}>
          <Link
            to={item.to}
            params={item.params}
            className="panel-interactive group flex h-full items-start gap-3 p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <item.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {item.title}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {item.description}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
