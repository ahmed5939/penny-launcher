import { StringUnion } from '../../utils.d'

/**
 * `ExecuteTerminalCommand` on the athena profile: a BR Lobby Hack code.
 *
 * Shapes from the community protocol docs (LeleDerGrasshalmi's
 * FortniteEndpointsDocumentation), not yet confirmed against a live
 * redemption. The reader treats every field as optional.
 */

export type MCPExecuteTerminalCommandPayload = {
  command: string
}

export type MCPTerminalCommandLootItem = {
  itemType: string
  itemGuid?: string
  itemProfile?: StringUnion<'athena' | 'common_core'>
  attributes?: Record<string, unknown>
  quantity?: number
}

export type MCPTerminalCommandNotification =
  | {
      type: 'terminalCommandResult'
      primary?: boolean
      client_request_id?: string
      canRepeat?: boolean
      rewardGranted?: boolean
      successActionTag?: string
    }
  | {
      type: 'questClaim'
      primary?: boolean
      client_request_id?: string
      questId?: string
      loot?: { items?: Array<MCPTerminalCommandLootItem> }
      questsAndRewards?: Array<{
        questId?: string
        loot?: { items?: Array<MCPTerminalCommandLootItem> }
      }>
    }

export type MCPExecuteTerminalCommandResponse = {
  profileRevision?: number
  profileId?: StringUnion<'athena'>
  profileChangesBaseRevision?: number
  profileChanges?: Array<unknown>
  profileCommandRevision?: number
  serverTime?: string
  responseVersion?: number
  notifications?: Array<
    MCPTerminalCommandNotification | { type: string; [key: string]: unknown }
  >
  multiUpdate?: Array<{
    profileId?: string
    notifications?: Array<{ type: string; [key: string]: unknown }>
  }>
}
