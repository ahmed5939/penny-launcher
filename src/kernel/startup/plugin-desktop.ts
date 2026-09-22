import os from 'node:os'
import { powerMonitor, screen } from 'electron'
import { z } from 'zod'
import { requirePluginPermission, type PluginRuntimeRecord } from './plugin-broker'

const lastReads = new WeakMap<PluginRuntimeRecord, Map<string, number>>()

/** Read-only desktop DTOs. Never return raw Electron objects or machine identifiers. */
export function dispatchDesktopOperation(plugin: PluginRuntimeRecord, method: string, args: unknown[]) {
  if (!['desktop.system', 'desktop.displays', 'desktop.power'].includes(method)) throw new Error('Unknown desktop operation.')
  requirePluginPermission(plugin.manifest, method)
  if (!plugin.host) throw new Error('Plugin stopped.')
  z.tuple([]).parse(args)
  const reads = lastReads.get(plugin) ?? new Map<string, number>()
  lastReads.set(plugin, reads)
  const now = Date.now()
  if (now - (reads.get(method) ?? -Infinity) < 1000) throw new Error('Wait one second between desktop reads.')
  reads.set(method, now)

  switch (method) {
    case 'desktop.system': return {
      platform: process.platform,
      release: os.release(),
      architecture: process.arch,
      totalMemoryBytes: os.totalmem(),
      availableMemoryBytes: os.freemem(),
      uptimeSeconds: Math.floor(os.uptime()),
    }
    case 'desktop.displays': {
      const primaryId = screen.getPrimaryDisplay().id
      return screen.getAllDisplays().slice(0, 16).map((display, index) => ({
        index, primary: display.id === primaryId,
        width: display.size.width, height: display.size.height,
        workAreaWidth: display.workAreaSize.width, workAreaHeight: display.workAreaSize.height,
        scaleFactor: display.scaleFactor,
      }))
    }
    case 'desktop.power': return { onBattery: powerMonitor.isOnBatteryPower() }
  }
}
