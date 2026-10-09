import type { OpenLlamasProgress, RecycleChoice } from '../../features/open-llamas/model'

import { create } from 'zustand'

import { isRunActive } from '../../features/open-llamas/model'
import { toast } from '../../lib/notifications'

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

/** One summary when a run ends, wherever the user is by then. Never one per batch. */
function announce(progress: OpenLlamasProgress) {
  const packs = `${progress.opened.toLocaleString()} ${progress.opened === 1 ? 'llama' : 'llamas'}`

  if (progress.status === 'done') toast.success(`Opened ${packs}`)
  else if (progress.status === 'cancelled') toast.info(`Stopped after opening ${packs}`)
  else toast.warning(`Opening llamas stopped after ${packs}. See Open llamas for why.`)
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
