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
    const mapped: Array<QuestView> = quests.map((quest) => {
      const record = getItemRecord(records, quest.templateId)
      const progressByName = new Map(
        quest.objectives.map((objective) => [
          objective.backendName.toLowerCase(),
          objective.completed,
        ])
      )

      const objectives: Array<QuestObjectiveView> = (
        record?.objectives ?? []
      ).map((objective) => ({
        description:
          objective.description ?? objective.backendName.replace(/_/g, ' '),
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

      return {
        itemId: quest.itemId,
        templateId: quest.templateId,
        name: record?.name ?? quest.templateId.split(':').pop() ?? 'Quest',
        description: record?.description ?? null,
        category: record?.category ?? 'Other',
        pinned: quest.pinned,
        objectives: fallback,
        rewards: record?.rewards ?? [],
        progress: totalTarget > 0 ? totalDone / totalTarget : 0,
      }
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

  const pinnedIds = views
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
