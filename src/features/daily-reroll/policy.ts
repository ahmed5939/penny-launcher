export type DailyQuestDefinition = {
  name: string
  objectives: Array<{ backendName: string; count: number }>
}

export type DailyRerollConfig = {
  enabled: boolean
  updateQuests?: boolean
  updatedDay?: string
  updateRetryAt?: number
  lastUpdateActivity?: string
  lastUpdateResult?: string
  keep: string[]
  checkedDay?: string
  attemptedDay?: string
  retryAt?: number
  lastActivity?: string
  lastResult?: string
}

export type DailyRerollData = Record<string, DailyRerollConfig>
export type DailyRerollPreferences = Pick<
  DailyRerollConfig,
  'enabled' | 'keep' | 'updateQuests'
>
export type DailyRerollStatus = {
  accounts: DailyRerollData
  questDataUnavailable?: boolean
  quests: Array<{
    templateId: string
    name: string
    description?: string | null
    objectives?: Array<{ description: string | null; count: number }>
    rewards?: Array<{ item: string; quantity: number }>
  }>
}

export function dueDay(config: DailyRerollConfig, now: Date): string | null {
  const day = now.toISOString().slice(0, 10)
  if (
    !config.enabled ||
    (now.getUTCHours() === 0 && now.getUTCMinutes() < 4) ||
    config.checkedDay === day ||
    config.attemptedDay === day ||
    (config.retryAt ?? 0) > now.getTime()
  )
    return null
  return day
}

export function updateDueDay(
  config: DailyRerollConfig,
  now: Date,
): string | null {
  const day = now.toISOString().slice(0, 10)
  if (
    !(config.updateQuests || config.enabled) ||
    (now.getUTCHours() === 0 && now.getUTCMinutes() < 1) ||
    config.updatedDay === day ||
    (config.updateRetryAt ?? 0) > now.getTime()
  )
    return null
  return day
}

export function normalizeDailyPreferences(
  settings: DailyRerollPreferences,
): DailyRerollPreferences {
  return {
    ...settings,
    updateQuests: settings.enabled || settings.updateQuests === true,
  }
}

export function selectDailyQuest(
  items: Record<string, { templateId: string; attributes?: unknown }>,
  definitions: Record<string, DailyQuestDefinition>,
  keep: string[],
) {
  const protectedTemplates = new Set(keep.map((id) => id.toLowerCase()))
  // Match Penny's last eligible quest selection, with conservative handling
  // of unknown objectives so missing game data never loses quest progress.
  let selected: { itemId: string; name: string } | null = null
  for (const [itemId, item] of Object.entries(items)) {
    const template = item.templateId.toLowerCase()
    const attributes = item.attributes as Record<string, unknown> | undefined
    if (
      !isDailyRerollQuest(template) ||
      attributes?.quest_state !== 'Active' ||
      protectedTemplates.has(template)
    )
      continue
    const definition = definitions[template]
    if (!definition?.objectives.length) continue
    const objectives = new Map(
      definition.objectives.map((o) => [o.backendName.toLowerCase(), o.count]),
    )
    const progress = Object.entries(attributes).filter(([key]) =>
      key.startsWith('completion_'),
    )
    if (
      definition.objectives.some(
        (o) =>
          !Number.isFinite(o.count) ||
          o.count <= 0 ||
          !progress.some(
            ([key]) =>
              key.slice(11).toLowerCase() === o.backendName.toLowerCase(),
          ),
      ) ||
      progress.some(([key, value]) => {
        const target = objectives.get(key.slice(11).toLowerCase())
        return (
          !target ||
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value / target > 0.5
        )
      })
    )
      continue
    selected = { itemId, name: definition.name }
  }
  return selected
}

export function isDailyRerollQuest(templateId: string) {
  const template = templateId.toLowerCase()
  return template.startsWith('quest:daily') && !template.includes('trigger')
}
