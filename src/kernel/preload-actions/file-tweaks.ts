import type {
  BasePatchStatus,
  ModifiedTrap,
  PatchResult,
  PatchStatus,
  TrapActionResult,
  TrapFamilyInfo,
  TrapHeightScaleEntry,
  TrapListItem,
  TrapNamedConfig,
  TrapStatus,
  WorkerPowerResult,
} from '../core/file-tweaks/trap-height-types'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * File Tweaks — direct game-file patching (Dev Builds, DevStairs, AirStrike,
 * trap heights, B.A.S.E.) and Worker Power generation.
 */

export type FileTweaksTrapsData = {
  base: BasePatchStatus
  families: Record<string, TrapFamilyInfo>
  heightScale: Array<TrapHeightScaleEntry>
  modified: Array<ModifiedTrap>
  namedConfigs: Array<TrapNamedConfig>
  traps: Array<TrapListItem>
}

export function getDevBuildsStatus(): Promise<PatchStatus> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksDevBuildsStatus)
}

export function toggleDevBuilds(): Promise<PatchResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksDevBuildsToggle)
}

export function getDevStairsStatus(): Promise<PatchStatus> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksDevStairsStatus)
}

export function toggleDevStairs(): Promise<PatchResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksDevStairsToggle)
}

export function getAirStrikeStatus(): Promise<PatchStatus> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksAirStrikeStatus)
}

export function toggleAirStrike(): Promise<PatchResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksAirStrikeToggle)
}

export function fetchTrapsData(): Promise<FileTweaksTrapsData> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksTrapsData)
}

export function getTrapStatus(guid: string): Promise<TrapStatus> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksTrapStatus, guid)
}

export function applyTrapHeight(
  guid: string,
  heightHex: string
): Promise<TrapActionResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.FileTweaksTrapApply,
    guid,
    heightHex
  )
}

export function revertTrapHeight(guid: string): Promise<TrapActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksTrapRevert, guid)
}

export function revertAllTrapHeights(): Promise<TrapActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksTrapsRevertAll)
}

export function getBaseStatus(): Promise<BasePatchStatus> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksBaseStatus)
}

export function applyBaseHeight(uuValue: number): Promise<TrapActionResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.FileTweaksBaseApply,
    uuValue
  )
}

export function revertBaseHeight(): Promise<TrapActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.FileTweaksBaseRevert)
}

export function generateWorkerPower(
  account: AccountData,
  mode: 'high' | 'low'
): Promise<WorkerPowerResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.FileTweaksWorkerPower,
    account,
    mode
  )
}
