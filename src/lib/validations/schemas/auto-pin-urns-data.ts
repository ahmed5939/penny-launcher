import { z } from 'zod'

export const autoPinUrnsServerDataSchema = z.boolean()
export const autoPinUrnsDataSchema = z.record(
  z.string(),
  autoPinUrnsServerDataSchema
)

export const autoPinQuestsDataSchema = z.record(
  z.string(),
  z.array(z.string())
)
