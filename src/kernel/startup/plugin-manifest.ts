import { z } from 'zod'
import { PLUGIN_CAPABILITIES, PLUGIN_PERMISSIONS } from '../../types/plugins'

const relativeFile = z.string().min(1).max(240).refine(
  (value) => !value.includes('\\') && !value.includes(':') &&
    !value.startsWith('/') && value.split('/').every((part) => part && part !== '..' && part !== '.'),
  'Use a relative file path without traversal or backslashes.'
)

/** Shared by discovery and execution: metadata is untrusted input. */
export const pluginManifestSchema = z.object({
  runtime: z.literal('sandbox').optional(),
  permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).max(20).transform((items) => [...new Set(items)]).optional(),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/).refine(
    (id) => !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id),
    'Reserved Windows folder name.'
  ),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).optional(),
  version: z.string().max(64).optional(),
  author: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  capabilities: z.array(z.enum(PLUGIN_CAPABILITIES)).max(20)
    .transform((items) => [...new Set(items)]).optional(),
  entry: relativeFile.optional(),
  readme: relativeFile.optional(),
  repository: z.string().max(2048).url().refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  }, 'Source links must use HTTPS without credentials.').optional(),
  apiVersion: z.number().int().positive().optional(),
})
