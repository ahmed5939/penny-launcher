import type { OpenLlamasProgress, RecycleChoice } from '../../features/open-llamas/model'

import { create } from 'zustand'

import { isRunActive } from '../../features/open-llamas/model'
import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'
import { useAccountListStore } from '../accounts/list'

/**
 * Open Llamas choices, per account, for this session only. Nothing here is
 * saved or shared with Auto Llamas: a run's settings are that run's.
 */
export type OpenLlamasChoices = {
  /**
   * Template ids the user excluded. Stored this way round so every owned type
   * starts included, and paging or filtering the list — which only changes
   * what is drawn — cannot touch a hidden type's state.
   */
  excluded: Array<string>
  /** The "Number to open" field exactly as typed. */
  count: string
  recycle: RecycleChoice
}

export const defaultChoices: OpenLlamasChoices = { excluded: [], count: '', recycle: 'none' }

export function toggleExcluded(excluded: ReadonlyArray<string>, templateId: string, include: boolean) {
  const rest = excluded.filter((id) => id !== templateId)
  return include ? rest : [...rest, templateId]
}

type OpenLlamasState = {
  choices: Record<string, OpenLlamasChoices>
  /** The latest progress of each account's last run. */
  runs: Record<string, OpenLlamasProgress>

  updateChoices: (accountId: string, patch: Partial<OpenLlamasChoices>) => void
  updateRun: (progress: OpenLlamasProgress) => void
  dismissRun: (accountId: string) => void
}

export const useOpenLlamasStore = create<OpenLlamasState>()((set) => ({
  choices: {},
  runs: {},

  updateChoices: (accountId, patch) =>
    set((state) => ({
      choices: { ...state.choices, [accountId]: { ...(state.choices[accountId] ?? defaultChoices), ...patch } },
    })),
  updateRun: (progress) => set((state) => ({ runs: { ...state.runs, [progress.accountId]: progress } })),
  dismissRun: (accountId) =>
    set((state) => {
      if (isRunActive(state.runs[accountId])) return state
      const runs = { ...state.runs }
      delete runs[accountId]
      return { runs }
    }),
}))

let listening = false

/**
 * The summary for a run that has ended. Names the account, because the user
 * may have switched away by the time it ends.
 */
export function runSummary(progress: Pick<OpenLlamasProgress, 'status' | 'opened'>, name: string | null) {
  const packs = `${progress.opened.toLocaleString()} ${progress.opened === 1 ? 'llama' : 'llamas'}`
  const on = name ? ` on ${name}` : ''

  if (progress.status === 'done') return { tone: 'success' as const, text: `Opened ${packs}${on}` }
  if (progress.status === 'cancelled') return { tone: 'info' as const, text: `Stopped after opening ${packs}${on}` }

  const why = name ? `Switch to ${name} and open Open llamas for why.` : 'See Open llamas for why.'
  return { tone: 'warning' as const, text: `Opening llamas${on} stopped after ${packs}. ${why}` }
}

/** One summary when a run ends, wherever the user is by then. Never one per batch. */
function announce(progress: OpenLlamasProgress) {
  const account = useAccountListStore.getState().accounts[progress.accountId]
  const { tone, text } = runSummary(progress, account ? parseCustomDisplayName(account) : null)

  toast[tone](text)
}

/**
 * Follows every run from the first visit to the page on, so progress keeps
 * up while the user is elsewhere and is there when they come back.
 */
export function listenForOpenLlamas() {
  if (listening) return
  listening = true

  window.electronAPI.onOpenLlamasProgress((progress) => {
    const previous = useOpenLlamasStore.getState().runs[progress.accountId]

    useOpenLlamasStore.getState().updateRun(progress)
    if (isRunActive(previous) && !isRunActive(progress)) announce(progress)
  })
  window.electronAPI
    .getOpenLlamasStatus()
    .then((all) => {
      const { runs, updateRun } = useOpenLlamasStore.getState()
      // An event that arrived first is newer than this answer.
      all.forEach((progress) => {
        if (!runs[progress.accountId]) updateRun(progress)
      })
    })
    .catch(() => undefined)
}
