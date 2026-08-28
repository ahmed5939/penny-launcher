import type {
  BasePatchStatus,
  ModifiedTrap,
  PatchStatus,
  TrapStatus,
  WorkerPowerResult,
} from '../../kernel/core/file-tweaks/trap-height-types'
import type { FileTweaksTrapsData } from '../../kernel/preload-actions/file-tweaks'

import { create } from 'zustand'

export type PatchKey = 'airStrike' | 'devBuilds' | 'devStairs'

export type FileTweaksState = {
  /** Which patch scan is currently running. */
  patchLoading: PatchKey | null
  patchStatuses: Partial<Record<PatchKey, PatchStatus>>

  trapsData: FileTweaksTrapsData | null
  trapsLoading: boolean
  trapsError: string | null

  /** Per-GUID scan results, filled in lazily as traps are inspected. */
  trapStatuses: Record<string, TrapStatus>
  /** The GUID currently being scanned or patched. */
  busyTrapGuid: string | null
  baseBusy: boolean

  workerPower: WorkerPowerResult | null
  workerPowerLoading: boolean
  workerPowerMode: 'high' | 'low'

  setPatchLoading: (key: PatchKey | null) => void
  setPatchStatus: (key: PatchKey, status: PatchStatus) => void
  setTrapsData: (data: FileTweaksTrapsData | null) => void
  setTrapsLoading: (value: boolean) => void
  setTrapsError: (value: string | null) => void
  setTrapStatus: (guid: string, status: TrapStatus) => void
  clearTrapStatuses: () => void
  setBusyTrapGuid: (guid: string | null) => void
  setBaseBusy: (value: boolean) => void
  patchTrapLocally: (guid: string, currentHeight: string) => void
  unpatchTrapLocally: (guid: string) => void
  setModifiedTraps: (modified: Array<ModifiedTrap>) => void
  setBaseStatus: (status: BasePatchStatus) => void
  setWorkerPower: (result: WorkerPowerResult | null) => void
  setWorkerPowerLoading: (value: boolean) => void
  setWorkerPowerMode: (mode: 'high' | 'low') => void
}

export const useFileTweaksStore = create<FileTweaksState>()((set) => ({
  patchLoading: null,
  patchStatuses: {},

  trapsData: null,
  trapsLoading: false,
  trapsError: null,

  trapStatuses: {},
  busyTrapGuid: null,
  baseBusy: false,

  workerPower: null,
  workerPowerLoading: false,
  workerPowerMode: 'high',

  setPatchLoading: (key) => set({ patchLoading: key }),
  setPatchStatus: (key, status) =>
    set((state) => ({
      patchStatuses: { ...state.patchStatuses, [key]: status },
    })),
  setTrapsData: (data) => set({ trapsData: data }),
  setTrapsLoading: (value) => set({ trapsLoading: value }),
  setTrapsError: (value) => set({ trapsError: value }),
  setTrapStatus: (guid, status) =>
    set((state) => ({
      trapStatuses: { ...state.trapStatuses, [guid]: status },
    })),
  clearTrapStatuses: () => set({ trapStatuses: {} }),
  setBusyTrapGuid: (guid) => set({ busyTrapGuid: guid }),
  setBaseBusy: (value) => set({ baseBusy: value }),
  patchTrapLocally: (guid, currentHeight) =>
    set((state) => ({
      trapsData: state.trapsData
        ? {
            ...state.trapsData,
            modified: upsertModified(state.trapsData.modified, guid, currentHeight, state),
          }
        : state.trapsData,
      trapStatuses:
        guid in state.trapStatuses
          ? {
              ...state.trapStatuses,
              [guid]: {
                ...state.trapStatuses[guid],
                currentHeight,
                isModified: true,
              },
            }
          : state.trapStatuses,
    })),
  unpatchTrapLocally: (guid) =>
    set((state) => ({
      trapsData: state.trapsData
        ? {
            ...state.trapsData,
            modified: state.trapsData.modified.filter(
              (trap) => trap.guid !== guid
            ),
          }
        : state.trapsData,
      trapStatuses: guid in state.trapStatuses
        ? {
            ...state.trapStatuses,
            [guid]: {
              ...state.trapStatuses[guid],
              isModified: false,
            },
          }
        : state.trapStatuses,
    })),
  setModifiedTraps: (modified) =>
    set((state) => ({
      trapsData: state.trapsData ? { ...state.trapsData, modified } : state.trapsData,
    })),
  setBaseStatus: (status) =>
    set((state) => ({
      trapsData: state.trapsData ? { ...state.trapsData, base: status } : state.trapsData,
    })),
  setWorkerPower: (result) => set({ workerPower: result }),
  setWorkerPowerLoading: (value) => set({ workerPowerLoading: value }),
  setWorkerPowerMode: (mode) => set({ workerPowerMode: mode }),
}))

function upsertModified(
  modified: Array<ModifiedTrap>,
  guid: string,
  currentHeight: string,
  state: FileTweaksState
): Array<ModifiedTrap> {
  const existing = modified.find((trap) => trap.guid === guid)

  if (existing) {
    return modified.map((trap) =>
      trap.guid === guid ? { ...trap, currentHeight } : trap
    )
  }

  const trap = state.trapsData?.traps.find((item) => item.guid === guid)

  if (!trap) {
    return modified
  }

  return [
    ...modified,
    {
      currentHeight,
      desc: trap.desc,
      guid,
      name: trap.name,
      rarity: trap.rarity,
      tier: trap.tier,
    },
  ]
}
