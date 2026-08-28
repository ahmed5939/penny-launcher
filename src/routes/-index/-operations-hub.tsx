import type { LucideIcon } from 'lucide-react'

import { Link } from '@tanstack/react-router'
import {
  Activity,
  BookOpen,
  Boxes,
  CalendarRange,
  Car,
  Compass,
  Gift,
  Globe,
  HeartPulse,
  Pin,
  Radar,
  Repeat,
  ScrollText,
  Shield,
  Store,
  Swords,
  Users,
  UserX,
  Zap,
} from 'lucide-react'

import { BetaBadge } from '../../components/navigation/beta-badge'

/**
 * Fortnite operations hub: every STW tool in one launcher-style grid.
 * Kept in sync with `navSections` so a tool cannot vanish from one surface.
 */

type HubItem = {
  beta?: boolean
  title: string
  description: string
  icon: LucideIcon
  to: string
}

const items: Array<HubItem> = [
  {
    title: 'Auto-kick',
    description: 'Kick, claim and save automatically on mission end',
    icon: UserX,
    to: '/stw-operations/automation',
  },
  {
    title: 'Taxi',
    description: 'Run accounts as mission taxis',
    icon: Car,
    to: '/stw-operations/taxi-service',
  },
  {
    title: 'Party',
    description: 'Kick or leave party, claim rewards in bulk',
    icon: Users,
    to: '/stw-operations/party',
  },
  {
    title: 'Expeditions',
    description: 'Collect and re-launch expeditions in bulk',
    icon: Compass,
    to: '/stw-operations/expeditions',
  },
  {
    title: 'Squads',
    description: 'Save and apply survivor squad loadouts',
    icon: Swords,
    to: '/stw-operations/squads',
  },
  {
    title: 'Vault',
    description: 'Every item the account owns, with recycle values',
    icon: Boxes,
    to: '/stw-operations/inventory',
  },
  {
    title: 'Compendium',
    description: 'Every hero, weapon and trap in the game',
    icon: BookOpen,
    to: '/stw-operations/compendium',
  },
  {
    title: 'Loadouts',
    description: 'Commanders, support teams, team perks and gadgets',
    icon: Users,
    to: '/stw-operations/loadouts',
  },
  {
    title: 'Quests',
    description: 'Objectives, progress and rewards — pin what matters',
    icon: ScrollText,
    to: '/stw-operations/quests',
  },
  {
    title: 'Timeline',
    description: 'Ventures seasons and their weekly event shops',
    icon: CalendarRange,
    to: '/stw-operations/timeline',
  },
  {
    title: 'Shop',
    description: 'X-Ray llama contents, event and weekly stores',
    icon: Store,
    to: '/stw-operations/shop',
  },
  {
    title: 'Auto-llamas',
    description: 'Open free llamas automatically',
    icon: Gift,
    to: '/stw-operations/auto-llamas',
  },
  {
    title: 'XP boosts',
    description: 'Check and consume XP boosts',
    icon: Zap,
    to: '/stw-operations/xpboosts',
  },
  {
    title: 'Urns',
    description: 'Keep urn and mini-boss quests pinned automatically',
    icon: Pin,
    to: '/stw-operations/urns',
  },
  {
    beta: true,
    title: 'Endurance',
    description: 'Storm Shield Endurance from outside the game. F8 stops it.',
    icon: Repeat,
    to: '/stw-operations/endurance',
  },
  {
    title: 'Profile',
    description: 'Power level, F.O.R.T., loadouts and collection at a glance',
    icon: HeartPulse,
    to: '/account-management/profile',
  },
  {
    title: 'Servers',
    description: 'Check Fortnite service availability and downtime',
    icon: Activity,
    to: '/advanced-mode/server-status',
  },
  {
    title: 'World info',
    description: 'Browse and export world info files',
    icon: Globe,
    to: '/advanced-mode/world-info',
  },
  {
    beta: true,
    title: 'Outpost',
    description: 'Storm shields, endurance waves and base scans',
    icon: Shield,
    to: '/stw-operations/outpost',
  },
  {
    title: 'Matchmaking',
    description: 'Track matchmaking for an account',
    icon: Radar,
    to: '/advanced-mode/matchmaking-track',
  },
]

export function OperationsHub() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.title}>
          <Link
            to={item.to}
            className="panel-interactive group flex h-full items-start gap-3 p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
              <item.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {item.title}
                {item.beta && <BetaBadge />}
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
