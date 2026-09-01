import type {
  OutpostBaseData,
  OutpostInfoResult,
  OutpostReportExportResult,
  OutpostZoneInfo,
} from '../core/outpost-types'
import type { AccountData } from '../../types/accounts'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * Outpost — Storm Shield zone overview and base structure/trap inventory.
 */

export function requestOutpostInfo(
  account: AccountData
): Promise<OutpostInfoResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.OutpostInfoRequest, account)
}

export function requestOutpostBaseData(
  account: AccountData,
  saveFile: string
): Promise<OutpostBaseData> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.OutpostBaseRequest,
    account,
    saveFile
  )
}

export function exportOutpostReport(
  displayName: string,
  zone: OutpostZoneInfo,
  baseData: OutpostBaseData
): Promise<OutpostReportExportResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.OutpostReportExport,
    displayName,
    zone,
    baseData
  )
}
