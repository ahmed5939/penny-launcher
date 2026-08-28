import type { QuestEntry } from '../../../kernel/core/quests'

import { useEffect, useMemo, useState } from 'react'

import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'

export type QuestObjectiveView = {
  description: string
  completed: number
  count: number
}

export type QuestView = {
  itemId: string
  templateId: string
  name: string
  description: string | null
  /** "DailyQuests", "Weekly", the event name … */
  category: string
  pinned: boolean
  objectives: Array<QuestObjectiveView>
  rewards: Array<{ item: string; quantity: number }>
  /** 0–1 across every objective. */
  progress: number
}

/** The game shows dailies first; everything else follows alphabetically. */
function categoryRank(category: string) {
  return category === 'DailyQuests' ? 0 : 1
}

/**
 * Quests the game runs but never shows.
 *
 * Every profile permanently holds a handful of Active bookkeeping quests —
 * the daily-quest pack and its trigger, the onboarding chain, the hero
 * loadout tutorials, the outpost first-open flags. Epic marks them two ways
 * and the database keeps both: a `DisplayName` wrapped in angle brackets,
 * which is what an asset with no localised name exports as, or a name
 * literally prefixed `(Hidden)`. They have no objectives, no rewards and no
 * category, so they otherwise land in the log as untitled cards under a
 * blank heading.
 */
function isHiddenQuest(name: string) {
  return name.startsWith('<') || name.startsWith('(Hidden)')
}

/** The first line with anything on it. Quest copy is multi-line: the goal,
 * then a paragraph of instructions the card has no room for. */
function firstLine(value: string | null | undefined) {
  return (
    value
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? null
  )
}

/** `daily_destroygnomes` → "Daily Destroygnomes". Only for quests the
 * database has never heard of, which is better than showing the raw id. */
function prettifyTemplateId(templateId: string) {
  return (templateId.split(':').pop() ?? templateId)
    .split(/[_.]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function useQuestsData() {
  useRequestItemDatabase()

  const { selected } = useGetSelectedAccount()
  const accountId = selected?.accountId ?? null

  const records = useItemDatabaseStore((state) => state.records)

  const [quests, setQuests] = useState<Array<QuestEntry>>([])
  const [rerolls, setRerolls] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [isPinning, setPinning] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  useEffect(() => {
    const listener = window.electronAPI.responseQuests(async (response) => {
      setLoading(false)
      setHasLoaded(true)
      setQuests(response.quests)
      setRerolls(response.rerolls)
      setErrorMessage(response.errorMessage ?? null)
    })

    return () => {
      listener.removeListener()
    }
  }, [])

  useEffect(() => {
    const listener = window.electronAPI.notificationQuestsPin(
      async (response) => {
        setPinning(false)

        if (response.errorMessage) {
          toast(`Could not update pins: ${response.errorMessage}`)
        }
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [])

  const handleLoad = () => {
    if (!selected) {
      return
    }

    setLoading(true)
    window.electronAPI.requestQuests(selected)
  }

  useEffect(() => {
    if (accountId) {
      handleLoad()
    }
  }, [accountId])

  /**
   * The profile only counts progress; the objective's target and wording
   * live in the game data, so the two are paired here by backend name.
   */
  const views = useMemo(() => {
    const mapped: Array<QuestView> = []

    quests.forEach((quest) => {
      const record = getItemRecord(records, quest.templateId)

      if (record && isHiddenQuest(record.name)) {
        return
      }

      const progressByName = new Map(
        quest.objectives.map((objective) => [
          objective.backendName.toLowerCase(),
          objective.completed,
        ])
      )

      /*
       * Every Wargames simulation and prerequisite ships its objective with an
       * empty description — the string is present, it is just blank, so `??`
       * never fires and the card gets a progress bar with no line above it.
       * The quest's own description says the same thing ("Complete the
       * "Denied" Wargames Simulation."), so a quest with a single objective
       * borrows it rather than showing nothing.
       */
      const summary =
        record?.objectives.length === 1 ? firstLine(record.description) : null

      const objectives: Array<QuestObjectiveView> = (
        record?.objectives ?? []
      ).map((objective) => ({
        description:
          (objective.description?.trim() || summary) ??
          objective.backendName.replace(/_/g, ' '),
        completed: progressByName.get(objective.backendName.toLowerCase()) ?? 0,
        count: objective.count,
      }))

      /**
       * Without the game data there is nothing to compare against, so fall
       * back to the raw counters rather than showing a quest with no body.
       */
      const fallback: Array<QuestObjectiveView> =
        objectives.length > 0
          ? objectives
          : quest.objectives.map((objective) => ({
              description: objective.backendName.replace(/_/g, ' '),
              completed: objective.completed,
              count: 0,
            }))

      const totalTarget = fallback.reduce(
        (accumulator, objective) => accumulator + objective.count,
        0
      )
      const totalDone = fallback.reduce(
        (accumulator, objective) =>
          accumulator + Math.min(objective.completed, objective.count || Infinity),
        0
      )

      mapped.push({
        itemId: quest.itemId,
        templateId: quest.templateId,
        name: record?.name ?? prettifyTemplateId(quest.templateId),
        description: record?.description ?? null,
        /** Empty, not absent, is how the database spells "uncategorised". */
        category: record?.category || 'Other',
        pinned: quest.pinned,
        objectives: fallback,
        rewards: record?.rewards ?? [],
        progress: totalTarget > 0 ? totalDone / totalTarget : 0,
      })
    })

    return mapped.sort((questA, questB) => {
      const rank = categoryRank(questA.category) - categoryRank(questB.category)

      if (rank !== 0) {
        return rank
      }

      if (questA.category !== questB.category) {
        return questA.category.localeCompare(questB.category)
      }

      return questA.name.localeCompare(questB.name)
    })
  }, [quests, records])

  const grouped = useMemo(() => {
    const groups = new Map<string, Array<QuestView>>()

    views.forEach((quest) => {
      groups.set(quest.category, [...(groups.get(quest.category) ?? []), quest])
    })

    return [...groups.entries()]
  }, [views])

  /*
   * From the raw list rather than `views`, because the log hides the profile's
   * bookkeeping quests and pinning writes the whole set back — anything
   * dropped from the display still has to survive the round trip.
   */
  const pinnedIds = quests
    .filter((quest) => quest.pinned)
    .map((quest) => quest.itemId)

  const handleTogglePin = (itemId: string) => {
    if (!selected || isPinning) {
      return
    }

    const next = pinnedIds.includes(itemId)
      ? pinnedIds.filter((value) => value !== itemId)
      : [...pinnedIds, itemId]

    setPinning(true)
    window.electronAPI.pinQuests(selected, next)
  }

  return {
    account: selected ?? null,
    errorMessage,
    grouped,
    hasLoaded,
    isLoading,
    isPinning,
    pinnedCount: pinnedIds.length,
    records,
    rerolls,
    total: views.length,

    handleLoad,
    handleTogglePin,
  }
}
