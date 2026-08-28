import type { LucideIcon } from 'lucide-react'
import type { CustomizableMenuSettings } from '../types/settings'

import {
  Activity,
  BookOpen,
  Boxes,
  CalendarRange,
  Car,
  Coins,
  Cog,
  Compass,
  Contact,
  FileText,
  Gift,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Pin,
  Puzzle,
  Radar,
  Repeat,
  Shield,
  ScrollText,
  Smartphone,
  Store,
  Swords,
  Ticket,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  UserX,
  Zap,
} from 'lucide-react'

/**
 * The app's navigation, described once.
 *
 * Both the rail and the ⌘K palette read from here, so a tool can never
 * appear in one and be missing from the other.
 *
 * Grouping is by job, not by the old Aerial menu names: launch/home first,
 * then background automations, then the STW tools you open by hand, then
 * account admin and diagnostics. Every previous destination is still here
 * (including taxi, endurance, auto-llamas, auto-kick).
 */

export type MenuKey = keyof CustomizableMenuSettings

export type NavItem = {
  /** Still settling — a small badge, not a quarantine. */
  beta?: boolean
  /** Customisable-menu key controlling visibility. */
  can?: MenuKey
  /** Visible while any of these keys is enabled — for one entry standing in for several legacy toggles. */
  canAny?: Array<MenuKey>
  icon: LucideIcon
  /** i18n key, or a literal when the product name is not translated. */
  label: string
  /** Meaningless with no linked account. */
  needsAccount?: boolean
  params?: Record<string, string>
  /** Live status source, if this tool runs in the background. */
  status?: 'auto-kick' | 'taxi-service'
  to: string
}

export type NavSection = {
  can?: MenuKey
  icon: LucideIcon
  items: Array<NavItem>
  /** Section header itself navigates here. */
  key: string
  label: string
  to?: string
}

/** Literal product names are not i18n keys. */
export function resolveNavLabel(
  t: (key: string) => string,
  label: string,
): string {
  return label.includes(':') ? t(label) : label
}

export function navDestinations(): Array<string> {
  return navSections.flatMap((section) => [
    ...(section.to ? [section.to] : []),
    ...section.items.map((item) => item.to),
  ])
}

export function visibilityKeys(
  item: Pick<NavItem, 'can' | 'canAny'>,
): Array<MenuKey> {
  if (item.canAny && item.canAny.length > 0) {
    return item.canAny
  }

  if (item.can) {
    return [item.can]
  }

  return []
}

export const navSections: Array<NavSection> = [
  {
    key: 'home',
    label: 'sidebar:home',
    icon: LayoutDashboard,
    to: '/',
    can: 'currentAlerts',
    items: [],
  },
  {
    key: 'automate',
    label: 'sidebar:groups.automate',
    icon: Zap,
    can: 'stwOperations',
    items: [
      {
        can: 'autoKick',
        icon: UserX,
        label: 'sidebar:stw-operations.options.auto-kick',
        status: 'auto-kick',
        to: '/stw-operations/automation',
      },
      {
        can: 'taxiService',
        icon: Car,
        label: 'sidebar:stw-operations.options.taxi-service',
        status: 'taxi-service',
        to: '/stw-operations/taxi-service',
      },
      {
        can: 'party',
        icon: Users,
        label: 'sidebar:stw-operations.options.party',
        to: '/stw-operations/party',
      },
      {
        can: 'autoLlamas',
        icon: Gift,
        label: 'sidebar:stw-operations.options.auto-llamas',
        to: '/stw-operations/auto-llamas',
      },
      {
        can: 'autoPinUrns',
        icon: Pin,
        label: 'sidebar:stw-operations.options.auto-pin-urns',
        to: '/stw-operations/urns',
      },
      {
        // Vision-driven menu walker — usable, but still the most experimental
        // tool in the rail, so it keeps a small badge.
        beta: true,
        can: 'endurance',
        icon: Repeat,
        label: 'sidebar:stw-operations.options.endurance',
        to: '/stw-operations/endurance',
      },
    ],
  },
  {
    key: 'stw',
    label: 'sidebar:groups.stw',
    icon: Swords,
    can: 'stwOperations',
    items: [
      {
        can: 'inventory',
        icon: Boxes,
        label: 'sidebar:stw-operations.options.inventory',
        to: '/stw-operations/inventory',
      },
      {
        can: 'loadouts',
        icon: Users,
        label: 'sidebar:stw-operations.options.loadouts',
        to: '/stw-operations/loadouts',
      },
      {
        can: 'squadPresets',
        icon: Swords,
        label: 'sidebar:stw-operations.options.squad-presets',
        to: '/stw-operations/squads',
      },
      {
        can: 'quests',
        icon: ScrollText,
        label: 'sidebar:stw-operations.options.quests',
        to: '/stw-operations/quests',
      },
      {
        can: 'expeditions',
        icon: Compass,
        label: 'sidebar:stw-operations.options.expeditions',
        to: '/stw-operations/expeditions',
      },
      {
        can: 'shop',
        icon: Store,
        label: 'sidebar:stw-operations.options.shop',
        to: '/stw-operations/shop',
      },
      {
        beta: true,
        icon: Trophy,
        label: 'stw-operations:leaderboards.title',
        to: '/stw-operations/leaderboards',
      },
      {
        can: 'timeline',
        icon: CalendarRange,
        label: 'sidebar:stw-operations.options.timeline',
        to: '/stw-operations/timeline',
      },
      {
        can: 'compendium',
        icon: BookOpen,
        label: 'sidebar:stw-operations.options.compendium',
        to: '/stw-operations/compendium',
      },
      {
        beta: true,
        can: 'outpost',
        icon: Shield,
        label: 'Outpost',
        needsAccount: true,
        to: '/stw-operations/outpost',
      },
      {
        can: 'xpBoosts',
        icon: Zap,
        label: 'sidebar:stw-operations.options.xp-boosts',
        to: '/stw-operations/xpboosts',
      },
    ],
  },
  {
    key: 'accounts',
    label: 'sidebar:groups.account',
    icon: Users,
    to: '/account',
    can: 'accountManagement',
    items: [
      {
        // One entry for all three sign-in methods; the page switches between
        // them in place. The legacy per-method toggles still gate it together.
        canAny: ['authorizationCode', 'exchangeCode', 'deviceAuth'],
        icon: UserPlus,
        label: 'Add account',
        params: { type: 'authorization-code' },
        to: '/accounts/add/$type',
      },
      {
        icon: Contact,
        label: 'sidebar:account-management.options.friends',
        needsAccount: true,
        to: '/account-management/friends',
      },
      {
        can: 'profile',
        icon: HeartPulse,
        label: 'sidebar:account-management.options.profile',
        to: '/account-management/profile',
      },
      {
        can: 'vbucksInformation',
        icon: Coins,
        label: 'sidebar:account-management.options.vbucks-information',
        to: '/account-management/vbucks-information',
      },
      {
        can: 'redeemCodes',
        icon: Ticket,
        label: 'sidebar:account-management.options.redeem-codes',
        to: '/account-management/redeem-codes',
      },
      {
        can: 'devicesAuth',
        icon: Smartphone,
        label: 'sidebar:account-management.options.devices-auth',
        needsAccount: true,
        to: '/account-management/devices-auth',
      },
      {
        can: 'epicGamesSettings',
        icon: Cog,
        label: 'sidebar:account-management.options.epic-settings',
        needsAccount: true,
        to: '/account-management/epic-games-settings',
      },
      {
        can: 'eula',
        icon: FileText,
        label: 'EULA',
        needsAccount: true,
        to: '/account-management/eula',
      },
      {
        can: 'removeAccount',
        icon: Trash2,
        label: 'sidebar:accounts.options.remove',
        needsAccount: true,
        to: '/accounts/remove',
      },
    ],
  },
  {
    key: 'advanced',
    label: 'sidebar:groups.tools',
    icon: Radar,
    can: 'advancedMode',
    items: [
      {
        can: 'matchmakingTrack',
        icon: Radar,
        label: 'sidebar:advanced-mode.options.matchmaking-track',
        needsAccount: true,
        to: '/advanced-mode/matchmaking-track',
      },
      {
        can: 'serverStatus',
        icon: Activity,
        label: 'sidebar:advanced-mode.options.server-status',
        to: '/advanced-mode/server-status',
      },
      {
        can: 'worldInfo',
        icon: Globe,
        label: 'sidebar:advanced-mode.options.world-info',
        to: '/advanced-mode/world-info',
      },
    ],
  },
  {
    key: 'plugins',
    label: 'Add-ons',
    icon: Puzzle,
    to: '/plugins',
    items: [],
  },
]
