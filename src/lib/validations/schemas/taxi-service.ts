import { z } from 'zod'

import { AutomationStatusType } from '../../../config/constants/automation'

const taxiServiceActionsSchema = z.object({
  autoReady: z.boolean().default(true),
  busyStatus: z.string().default(''),
  denyFriendsRequests: z.boolean().default(true),
  emote: z.string().default('EID_Floss'),
  /**
   * Legacy binary stats toggle — superseded by `powerLevel`. Kept optional
   * so stored configs migrate instead of failing validation.
   */
  high: z.boolean().optional(),
  activeStatus: z.string().default(''),
  isPrivate: z.boolean().default(false),
  leaveMinutes: z.number().min(1).max(30).default(2),
  level: z.number().min(1).max(10_000).default(100),
  powerLevel: z.number().min(1).max(288).optional(),
  skin: z.string().default('CID_028_Athena_Commando_F'),
})

const taxiServiceWhitelistEntrySchema = z.object({
  accountId: z.string().min(1),
  displayName: z.string().default(''),
})

export const taxiServiceServerDataSchema = z.object({
  accountId: z.string().min(1),
  actions: taxiServiceActionsSchema,
  status: z.nativeEnum(AutomationStatusType).nullable(),
  whitelist: taxiServiceWhitelistEntrySchema
    .array()
    .default([]),
})
export const taxiServiceServerSchema = z.record(
  z.string(),
  taxiServiceServerDataSchema,
)

export const taxiServiceFileDataSchema = z.object({
  accountId: z.string().min(1),
  actions: taxiServiceActionsSchema,
  whitelist: taxiServiceWhitelistEntrySchema
    .array()
    .default([]),
})
export const taxiServiceFileSchema = z.record(
  z.string(),
  taxiServiceFileDataSchema,
)
