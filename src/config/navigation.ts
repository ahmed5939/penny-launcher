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
  FileText,
  Gift,
  Globe,
  HeartPulse,
  LayoutDashboard,
  Pin,
  Puzzle,
  Radar,
  ScrollText,
  Smartphone,
  Store,
  Swords,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  UserX,
  Wrench,
  Zap,
} from 'lucide-react'

/**
 * The app's navigation, described once.
 *
 * Both the top section menus and the ⌘K palette read from here, so a tool
 * can never appear in one and be missing from the other.
 */

export type MenuKey = keyof CustomizableMenuSettings

export type NavItem = {
  /** Newly added, still settling — renders a BETA badge wherever it appears. */
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

export const navSections: Array<NavSection> = [
  {
    key: 'home',
    label: 'general:go-to-current-alerts',
    icon: LayoutDashboard,
    to: '/',
    can: 'currentAlerts',
    items: [],
  },
  {
    key: 'operations',
    label: 'sidebar:stw-operations.title',
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
        beta: true,
        can: 'expeditions',
        icon: Compass,
        label: 'sidebar:stw-operations.options.expeditions',
        to: '/stw-operations/expeditions',
      },
      {
        beta: true,
        can: 'squadPresets',
        icon: Swords,
        label: 'sidebar:stw-operations.options.squad-presets',
        to: '/stw-operations/squads',
      },
      {
        beta: true,
        can: 'inventory',
        icon: Boxes,
        label: 'sidebar:stw-operations.options.inventory',
        to: '/stw-operations/inventory',
      },
      {
        beta: true,
        can: 'compendium',
        icon: BookOpen,
        label: 'sidebar:stw-operations.options.compendium',
        to: '/stw-operations/compendium',
      },
      {
        beta: true,
        can: 'loadouts',
        icon: Users,
        label: 'sidebar:stw-operations.options.loadouts',
        to: '/stw-operations/loadouts',
      },
      {
        beta: true,
        can: 'quests',
        icon: ScrollText,
        label: 'sidebar:stw-operations.options.quests',
        to: '/stw-operations/quests',
      },
      {
        beta: true,
        can: 'timeline',
        icon: CalendarRange,
        label: 'sidebar:stw-operations.options.timeline',
        to: '/stw-operations/timeline',
      },
      {
        beta: true,
        can: 'shop',
        icon: Store,
        label: 'sidebar:stw-operations.options.shop',
        to: '/stw-operations/shop',
      },
      {
        can: 'xpBoosts',
        icon: Zap,
        label: 'sidebar:stw-operations.options.xp-boosts',
        to: '/stw-operations/xpboosts',
      },
      {
        can: 'autoPinUrns',
        icon: Pin,
        label: 'sidebar:stw-operations.options.auto-pin-urns',
        to: '/stw-operations/urns',
      },
      {
        can: 'autoLlamas',
        icon: Gift,
        label: 'sidebar:stw-operations.options.auto-llamas',
        to: '/stw-operations/auto-llamas',
      },
    ],
  },
  {
    key: 'accounts',
    label: 'sidebar:account-management.title',
    icon: Users,
    to: '/account',
    can: 'accountManagement',
    items: [
      {
        can: 'vbucksInformation',
        icon: Coins,
        label: 'sidebar:account-management.options.vbucks-information',
        to: '/account-management/vbucks-information',
      },
      {
        beta: true,
        can: 'profile',
        icon: HeartPulse,
        label: 'sidebar:account-management.options.profile',
        to: '/account-management/profile',
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
        // One entry for all three sign-in methods; the page switches between
        // them in place. The legacy per-method toggles still gate it together.
        canAny: ['authorizationCode', 'exchangeCode', 'deviceAuth'],
        icon: UserPlus,
        label: 'Add account',
        params: { type: 'authorization-code' },
        to: '/accounts/add/$type',
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
    label: 'sidebar:advanced-mode.title',
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
        beta: true,
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
      {
        beta: true,
        can: 'fileTweaks',
        icon: Wrench,
        label: 'File Tweaks',
        to: '/advanced-mode/file-tweaks',
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
