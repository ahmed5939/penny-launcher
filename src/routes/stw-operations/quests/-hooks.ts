import type { QuestEntry, QuestsPayload } from '../../../kernel/core/quests'
import type { AccountData } from '../../../types/accounts'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getItemRecord,
  useItemDatabaseStore,
} from '../../../state/items/database'
import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'

import { useAccountListStore } from '../../../state/accounts/list'

import { useAccountResource } from '../../../components/page'

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

/** How long to wait for the main process before giving up on a reply. */
const REPLY_TIMEOUT_MS = 60_000

/**
 * The quests IPC is fire-and-forget: a request goes out and the reply comes
 * back on a shared channel. This turns the next reply for one account into a
 * promise, so the page can load through `useAccountResource`. The listener is
 * registered before anything is sent, so a fast reply cannot be missed.
 */
function nextQuestsReply(accountId: string) {
  return new Promise<QuestsPayload>((resolve, reject) => {
    const listener = window.electronAPI.responseQuests(async (response) => {
      if (response.accountId !== accountId) return
      finish()
      if (response.errorMessage) reject(new Error(`${response.errorMessage}. Try Refresh.`))
      else resolve(response)
    })
    const timer = window.setTimeout(() => {
      finish()
      reject(new Error('Epic did not answer in time. Try Refresh.'))
    }, REPLY_TIMEOUT_MS)
    function finish() {
      window.clearTimeout(timer)
      listener.removeListener()
    }
  })
}

/**
 * The IPC still takes the whole account record; the page only knows the id.
 * Looked up at call time so a token refresh is always the current one.
 */
function accountById(accountId: string): AccountData {
  const account = useAccountListStore.getState().accounts[accountId]
  if (!account) throw new Error('This account is no longer signed in to Penny.')
  return account
}

/**
 * Loads the quest log for the selected account and pins quests on it.
 *
 * Pinning replies twice: a pin notification, then — because the main process
 * re-reads the profile after every pin — a fresh quest log. The wait for that
 * second reply starts before the pin is sent and is handed to the next load,
 * so a pin refreshes the list without a second request to Epic.
 */
export function useQuestsResource() {
  const pinReply = useRef<{ accountId: string; reply: Promise<QuestsPayload> } | null>(null)
  const [isPinning, setPinning] = useState(false)

  const resource = useAccountResource(
    async (accountId) => {
      const pending = pinReply.current
      pinReply.current = null
      if (pending && pending.accountId === accountId) return pending.reply
      const reply = nextQuestsReply(accountId)
      window.electronAPI.requestQuests(accountById(accountId))
      return reply
    },
    {
      cacheKey: 'stw.quests',
      fallbackError: 'Could not read the quest log. Try Refresh.',
      owner: (result) => result.accountId,
    }
  )
  const { refresh } = resource

  useEffect(() => {
    const listener = window.electronAPI.notificationQuestsPin(
      async (response) => {
        setPinning(false)

        if (response.errorMessage) {
          toast.error(`Could not update pins: ${response.errorMessage}`)
        }

        if (pinReply.current?.accountId === response.accountId) refresh()
      }
    )

    return () => {
      listener.removeListener()
    }
  }, [refresh])

  /*
   * From the raw list rather than the display views, because the log hides
   * the profile's bookkeeping quests and pinning writes the whole set back —
   * anything dropped from the display still has to survive the round trip.
   */
  const togglePin = (data: QuestsPayload, itemId: string) => {
    if (isPinning) {
      return
    }

    const pinnedIds = data.quests
      .filter((quest) => quest.pinned)
      .map((quest) => quest.itemId)
    const next = pinnedIds.includes(itemId)
      ? pinnedIds.filter((value) => value !== itemId)
      : [...pinnedIds, itemId]

    let account: AccountData
    try {
      account = accountById(data.accountId)
    } catch (error) {
      toast.error(`Could not update pins: ${(error as Error).message}`)
      return
    }

    const reply = nextQuestsReply(data.accountId)
    // Only the load that picks this up reports a failure.
    reply.catch(() => undefined)
    pinReply.current = { accountId: data.accountId, reply }
    setPinning(true)
    window.electronAPI.pinQuests(account, next)
  }

  return { isPinning, resource, togglePin }
}

/** The quest log as the page shows it: named, paired with its targets, grouped. */
export function useQuestViews(quests: Array<QuestEntry>) {
  useRequestItemDatabase()

  const records = useItemDatabaseStore((state) => state.records)

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

  const pinnedCount = quests.filter((quest) => quest.pinned).length

  return {
    grouped,
    pinnedCount,
    records,
    total: views.length,
  }
}
