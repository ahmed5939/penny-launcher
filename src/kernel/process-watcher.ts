import type { ProcessDescriptor } from 'ps-list'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { RuntimeLog } from './runtime-log'

export type WatchedProcess = {
  id: number
  name: string
}

type Listener = (processes: Array<WatchedProcess>) => void

const execFileAsync = promisify(execFile)

/**
 * One shared, non-blocking process poll for every feature that needs to know
 * whether Fortnite is alive. This replaces node-process-watcher: that addon
 * uses Node-API but does not publish prebuilds for current Node/Electron, so
 * Forge fell back to node-gyp before the app could start.
 */
export class ProcessWatcher {
  private static listeners = new Map<string, { listener: Listener; intervalMs: number }>()
  private static timer: NodeJS.Timeout | null = null
  private static polling = false
  private static lastErrorAt = 0

  static on(id: string, listener: Listener, intervalMs = 2_000) {
    ProcessWatcher.listeners.set(id, { listener, intervalMs })
    if (ProcessWatcher.timer) clearTimeout(ProcessWatcher.timer)
    ProcessWatcher.timer = null
    void ProcessWatcher.poll()
  }

  static setInterval(id: string, intervalMs: number) {
    const entry = ProcessWatcher.listeners.get(id)
    if (entry) entry.intervalMs = intervalMs
  }

  static close(id: string) {
    ProcessWatcher.listeners.delete(id)
    if (ProcessWatcher.listeners.size === 0 && ProcessWatcher.timer) {
      clearTimeout(ProcessWatcher.timer)
      ProcessWatcher.timer = null
    }
  }

  static async killProcess(id: number, tree = false) {
    if (process.platform === 'win32') {
      await execFileAsync(
        'taskkill',
        ['/PID', String(id), ...(tree ? ['/T'] : []), '/F'],
        { windowsHide: true }
      )

      return
    }

    process.kill(id, 'SIGTERM')
  }

  private static async poll() {
    if (ProcessWatcher.polling || ProcessWatcher.listeners.size === 0) {
      return
    }

    ProcessWatcher.polling = true

    try {
      const { default: psList } = await import('ps-list')
      const processes = (await psList()).map(ProcessWatcher.toWatchedProcess)

      for (const { listener } of ProcessWatcher.listeners.values()) {
        listener(processes)
      }
    } catch (error) {
      // Avoid writing the same environmental failure every two seconds.
      if (Date.now() - ProcessWatcher.lastErrorAt > 60_000) {
        ProcessWatcher.lastErrorAt = Date.now()
        RuntimeLog.error('process-watcher:list', error)
      }
    } finally {
      ProcessWatcher.polling = false
      if (ProcessWatcher.listeners.size > 0) {
        const intervalMs = Math.min(...[...ProcessWatcher.listeners.values()].map((entry) => entry.intervalMs))
        ProcessWatcher.timer = setTimeout(() => {
          ProcessWatcher.timer = null
          void ProcessWatcher.poll()
        }, intervalMs)
        ProcessWatcher.timer.unref()
      }
    }
  }

  private static toWatchedProcess(process: ProcessDescriptor): WatchedProcess {
    return { id: process.pid, name: process.name }
  }
}
