import type { IpcRendererEvent } from 'electron'
import type {
  CloudSavesDownloadProgress,
  CloudSavesResponse,
  LibraryReply,
  LibraryResponse,
  LibraryStoreResponse,
} from '../../features/library/model'

import type { LibraryOverviewPayload } from '../../features/library/collection'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

/**
 * The Library page's reads, as promises for `useAccountResource`.
 *
 * Each is a send and a reply tagged with the request it answers, rather than
 * an `invoke`: `secureIpcHandle` flattens every main-process failure to
 * "Request failed.", and the reply here carries the actual reason ("Could
 * not read the cloud saves (HTTP 403)…") through to the page.
 */

let sequence = 0

function nextRequestId(prefix: string) {
  sequence += 1

  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

/** Library reads finish in seconds; a reply this late is never coming. */
const replyTimeoutMs = 3 * 60 * 1000

function request<Result>(
  requestChannel: ElectronAPIEventKeys,
  replyChannel: ElectronAPIEventKeys,
  prefix: string,
  ...args: Array<string | boolean>
) {
  const requestId = nextRequestId(prefix)

  return new Promise<Result>((resolve, reject) => {
    const listener = (_: IpcRendererEvent, reply: LibraryReply<Result>) => {
      if (reply?.requestId !== requestId) {
        return
      }

      clearTimeout(timer)
      ipcRenderer.removeListener(replyChannel, listener)

      if (reply.result !== undefined) {
        resolve(reply.result)
      } else {
        reject(new Error(reply.error ?? 'Could not load the library. Try Refresh.'))
      }
    }
    const timer = setTimeout(() => {
      ipcRenderer.removeListener(replyChannel, listener)
      reject(new Error('Penny did not answer in time. Try Refresh.'))
    }, replyTimeoutMs)

    ipcRenderer.on(replyChannel, listener)
    ipcRenderer.send(requestChannel, requestId, ...args)
  })
}

/** What the account owns in Fortnite. `refresh` re-reads the catalogue too. */
export function requestLibrary(accountId: string, refresh = false) {
  return request<LibraryResponse>(
    ElectronAPIEventKeys.LibraryRequest,
    ElectronAPIEventKeys.LibraryResponse,
    'library',
    accountId,
    refresh
  )
}

/** Fortnite's Epic Games Store offers, priced for the OS's country. Not per account. */
export function requestLibraryStore(refresh = false) {
  return request<LibraryStoreResponse>(
    ElectronAPIEventKeys.LibraryStoreRequest,
    ElectronAPIEventKeys.LibraryStoreResponse,
    'library-store',
    refresh
  )
}

/** The account's Epic cloud saves, by game. */
export function requestCloudSaves(accountId: string) {
  return request<CloudSavesResponse>(
    ElectronAPIEventKeys.CloudSavesRequest,
    ElectronAPIEventKeys.CloudSavesResponse,
    'cloud-saves',
    accountId
  )
}

/**
 * Copies one game's cloud saves to a folder the user picks. Resolves when it
 * is over — saved, cancelled at the folder dialog, or failed — with the last
 * progress report. No timeout: the folder dialog waits on the user.
 */
export function downloadCloudSaves(accountId: string, appName: string) {
  const requestId = nextRequestId('cloud-saves-download')

  return new Promise<CloudSavesDownloadProgress>((resolve) => {
    const listener = (
      _: IpcRendererEvent,
      progress: CloudSavesDownloadProgress
    ) => {
      if (progress?.requestId !== requestId || progress.status === 'running') {
        return
      }

      ipcRenderer.removeListener(
        ElectronAPIEventKeys.CloudSavesDownloadProgress,
        listener
      )
      resolve(progress)
    }

    ipcRenderer.on(ElectronAPIEventKeys.CloudSavesDownloadProgress, listener)
    ipcRenderer.send(
      ElectronAPIEventKeys.CloudSavesDownload,
      requestId,
      accountId,
      appName
    )
  })
}

export function onCloudSavesDownloadProgress(
  callback: (progress: CloudSavesDownloadProgress) => void
) {
  const customCallback = (
    _: IpcRendererEvent,
    progress: CloudSavesDownloadProgress
  ) => {
    callback(progress)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.CloudSavesDownloadProgress,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.CloudSavesDownloadProgress,
        customCallback
      ),
  }
}

/** Every linked account's Epic library and game profile. `refresh` skips the cache. */
export function requestLibraryOverview(refresh = false) {
  ipcRenderer.send(ElectronAPIEventKeys.LibraryOverviewRequest, refresh)
}

export function responseLibraryOverview(
  callback: (response: LibraryOverviewPayload) => Promise<void>
) {
  const customCallback = (_: IpcRendererEvent, response: LibraryOverviewPayload) => {
    callback(response).catch(console.error)
  }
  const rendererInstance = ipcRenderer.on(
    ElectronAPIEventKeys.LibraryOverviewResponse,
    customCallback
  )

  return {
    removeListener: () =>
      rendererInstance.removeListener(
        ElectronAPIEventKeys.LibraryOverviewResponse,
        customCallback
      ),
  }
}
