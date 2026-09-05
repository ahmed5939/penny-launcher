import type { PluginPermission } from '../../types/plugins'
export const permissionLabels: Record<PluginPermission, string> = {
  'accounts:read': 'Read account names and current selection',
  'quests:read': 'Read quests for selected accounts (authenticated)',
  'settings:read': 'Read game path and launcher connection settings',
  storage: 'Save data in this add-on’s JSON store',
  navigation: 'Navigate to Penny pages',
  notifications: 'Show desktop notifications',
  'external-links': 'Open HTTPS links in your browser',
  ui: 'Add panels, actions, and settings to its add-on card',
}
