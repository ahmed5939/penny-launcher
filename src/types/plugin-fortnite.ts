/** Every MCP profile Penny can address for a selected account. Unknown profile ids stay rejected. */
export const PLUGIN_FORTNITE_PROFILES = [
  'campaign', 'athena', 'common_core', 'common_public', 'collections', 'creative', 'metadata',
  'theater0', 'theater1', 'theater2', 'outpost0', 'recycle_bin', 'profile0',
  'collection_book_people0', 'collection_book_schematics0',
] as const
export type PluginFortniteProfile = (typeof PLUGIN_FORTNITE_PROFILES)[number]
/** Any MCP command name. Penny validates the bodies it knows and passes the rest through. */
export const PLUGIN_MCP_OPERATION_PATTERN = /^[A-Z][A-Za-z0-9]{1,79}$/
export type PluginMCPOperation = string
/** Real money, gifts to other accounts, refunds and commerce settings: a Penny dialog on every call, whatever the API version. */
export const PLUGIN_MCP_CONFIRMED_OPERATIONS = [
  'PurchaseCatalogEntry', 'PurchaseMultipleCatalogEntries', 'GiftCatalogEntry', 'RefundMtxPurchase', 'RefundItem',
  'SetReceiveGiftsEnabled', 'SetAffiliateName', 'SetMtxPlatform', 'VerifyRealMoneyPurchase',
] as const
/**
 * From API v6 the install/update review approves every declared command, and only the
 * operations above ask again. Older packages were approved expecting a dialog per command.
 */
export const PLUGIN_INSTALL_APPROVAL_API_VERSION = 6
export function pluginCommandNeedsDialog(operation: string, apiVersion: number | undefined) {
  return (apiVersion ?? 1) < PLUGIN_INSTALL_APPROVAL_API_VERSION ||
    (PLUGIN_MCP_CONFIRMED_OPERATIONS as readonly string[]).includes(operation)
}
export type PluginFortniteAccess = { profiles: PluginFortniteProfile[]; operations: PluginMCPOperation[] }
