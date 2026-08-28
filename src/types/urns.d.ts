import type {
  autoPinUrnsDataSchema,
  autoPinUrnsServerDataSchema,
  autoPinQuestsDataSchema,
} from '../lib/validations/schemas/auto-pin-urns-data'

import { z } from 'zod'

export type AutoPinUrnDataList = z.infer<typeof autoPinUrnsDataSchema>
export type AutoPinUrnDataValue = z.infer<
  typeof autoPinUrnsServerDataSchema
>
export type AutoPinQuestDataList = z.infer<typeof autoPinQuestsDataSchema>
