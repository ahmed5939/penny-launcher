import { z } from 'zod'
import { AutomationStatusType } from '../config/constants/automation'

import {
  taxiServiceFileDataSchema,
  taxiServiceFileSchema,
  taxiServiceServerDataSchema,
  taxiServiceServerSchema,
} from '../lib/validations/schemas/taxi-service'

export type TaxiServiceWhitelistEntry = {
  accountId: string
  displayName: string
}

export type TaxiServiceAccountData = {
  accountId: string
  actions: {
    autoReady: boolean
    busyStatus: string
    denyFriendsRequests: boolean
    emote: string
    isPrivate: boolean
    leaveMinutes: number
    level: number
    powerLevel: number
    skin: string
    activeStatus: string
  }
  submittings: {
    connecting: boolean
    removing: boolean
  }
  status: AutomationStatusType | null
  whitelist: Array<TaxiServiceWhitelistEntry>
}

export type TaxiServiceAccountDataList = Record<
  string,
  TaxiServiceAccountData
>

export type TaxiServiceAccountFileData = z.infer<
  typeof taxiServiceFileDataSchema
>

export type TaxiServiceAccountFileDataList = z.infer<
  typeof taxiServiceFileSchema
>

export type TaxiServiceAccountServerData = z.infer<
  typeof taxiServiceServerDataSchema
>

export type TaxiServiceAccountServerDataList = z.infer<
  typeof taxiServiceServerSchema
>

export type TaxiServiceServiceStatusResponse = {
  accountId: string
  status: AutomationStatusType
}

export type TaxiServiceServiceLogEntry = {
  accountId: string
  level: 'error' | 'info' | 'success' | 'warn'
  message: string
  timestamp: number
}

export type TaxiServiceServiceActionConfig = {
  type: keyof TaxiServiceAccountData['actions']
  value: boolean | number | string
}
