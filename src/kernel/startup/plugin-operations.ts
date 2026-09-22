import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { dialog } from 'electron'
import { z } from 'zod'
import { AccountsManager } from './accounts'
import { PluginBridge } from './plugin-api'
import { pluginLog, requirePluginPermission, type PluginRuntimeRecord } from './plugin-broker'
import { MainWindow } from './windows/main'
import { Inventory } from '../core/inventory'
import { Authentication } from '../core/authentication'
import { setRecycleItemBatch } from '../../services/endpoints/mcp'

const accountIdSchema = z.string().min(1).max(128)
const selectionSchema = z.array(z.string().min(1).max(128)).min(1).max(50)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate item ids.')
const limits = new WeakMap<PluginRuntimeRecord, Map<string, number>>()
const execute = promisify(execFile)
let recycling = false
let closing = false

function throttle(plugin: PluginRuntimeRecord, operation: string, delay: number) {
  const times = limits.get(plugin) ?? new Map<string, number>()
  limits.set(plugin, times)
  const now = Date.now()
  if (now - (times.get(operation) ?? -Infinity) < delay) throw new Error('Plugin operation is rate limited.')
  times.set(operation, now)
}

/** Capture the exact runtime and selection generation, including away-and-back changes. */
function guard(plugin: PluginRuntimeRecord, method: string, accountId?: string) {
  const host = plugin.host
  const revision = PluginBridge.getAccountScopeRevision()
  const check = () => {
    requirePluginPermission(plugin.manifest, method)
    if (!host || plugin.host !== host) throw new Error('Plugin stopped or restarted.')
    if (accountId) {
      const scope = PluginBridge.getAccountScope()
      if (revision !== PluginBridge.getAccountScopeRevision() ||
        (scope.primary !== accountId && !scope.members.includes(accountId)) ||
        !AccountsManager.getAccountById(accountId)) throw new Error('Account scope changed or account is unavailable.')
    }
  }
  check()
  return check
}

async function confirmRecycle(detail: string, check: () => void) {
  const window = MainWindow.instance
  if (!window || window.isDestroyed()) throw new Error('Open Penny to review recycling.')
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 60_000)
  const monitor = setInterval(() => {
    try { check() } catch { abort.abort() }
  }, 250)
  try {
    const result = await dialog.showMessageBox(window, {
      type: 'warning', title: 'Penny — Review inventory recycling',
      message: 'Permanently recycle these items?', detail,
      buttons: ['Cancel', 'Recycle items'], defaultId: 0, cancelId: 0,
      noLink: true, signal: abort.signal,
    })
    check()
    return !abort.signal.aborted && result.response === 1
  } finally {
    clearTimeout(timeout)
    clearInterval(monitor)
  }
}

export async function dispatchPluginOperation(plugin: PluginRuntimeRecord, method: string, args: unknown[]) {
  requirePluginPermission(plugin.manifest, method)
  if (method === 'epicLauncher.close') {
    z.tuple([]).parse(args)
    const check = guard(plugin, method)
    if (process.platform !== 'win32') throw new Error('Epic Launcher close is supported on Windows only.')
    if (closing) throw new Error('Epic Launcher close is already running.')
    throttle(plugin, method, 10_000)
    closing = true
    try {
      check()
      // Fixed executable and image only: no shell, caller-selected PID, process tree or elevation.
      await execute(path.win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/IM', 'EpicGamesLauncher.exe', '/F'], { windowsHide: true, timeout: 5000, maxBuffer: 16_384 })
      pluginLog(plugin, 'info', 'Closed Epic Games Launcher.')
      check()
      return { closed: true }
    } finally { closing = false }
  }
  if (method !== 'inventory.read' && method !== 'inventory.recycle') throw new Error('Unknown plugin operation.')
  const accountId = accountIdSchema.parse(args[0])
  const itemIds = method === 'inventory.recycle' ? selectionSchema.parse(args[1]) : []
  if (args.length !== (method === 'inventory.read' ? 1 : 2)) throw new Error('Unexpected operation arguments.')
  const check = guard(plugin, method, accountId)
  const account = AccountsManager.getAccountById(accountId)!
  if (method === 'inventory.read') {
    throttle(plugin, method, 10_000)
    const entry = await Inventory.getInventory(account)
    check()
    if (entry.errorMessage) throw new Error('Inventory is unavailable.')
    return entry
  }
  if (recycling) throw new Error('Another plugin recycling request is pending.')
  throttle(plugin, method, 30_000)
  recycling = true
  try {
    const entry = await Inventory.getInventory(account)
    check()
    if (entry.errorMessage) throw new Error('Inventory is unavailable.')
    const requested = new Set(itemIds)
    const targets = entry.items.filter((item) => requested.has(item.itemId) && item.lockedReason === null)
    const result = { accountId, recycled: 0, skipped: itemIds.length - targets.length, cancelled: false }
    if (!targets.length) return result
    const detail = `Add-on: ${plugin.manifest.name}\nAccount: ${account.displayName} (${accountId})\n\n` +
      targets.map((item) => `${item.name} — ${item.rarity}, level ${item.level}, quantity ${item.quantity}\n${item.templateId}\n${item.itemId}`).join('\n\n') +
      '\n\nThis cannot be undone. Favorites and equipped items are protected.'
    if (!await confirmRecycle(detail, check)) return { ...result, cancelled: true }
    const accessToken = await Authentication.verifyAccessToken(account)
    check()
    if (!accessToken) throw new Error('Account authentication is unavailable.')
    // Re-read after the human review; only the displayed, still-unlocked copies may be recycled.
    const fresh = await Inventory.getInventory(account)
    check()
    if (fresh.errorMessage) throw new Error('Inventory is unavailable.')
    const approved = new Map(targets.map((item) => [item.itemId, JSON.stringify(item)]))
    const targetItemIds = fresh.items.filter((item) => item.lockedReason === null &&
      approved.get(item.itemId) === JSON.stringify(item)).map((item) => item.itemId)
    result.skipped = itemIds.length - targetItemIds.length
    if (targetItemIds.length) {
      check()
      await setRecycleItemBatch({ accessToken, accountId, targetItemIds })
      pluginLog(plugin, 'info', `Recycled ${targetItemIds.length} items for ${accountId} after user confirmation.`)
      check()
      result.recycled = targetItemIds.length
    }
    return result
  } finally { recycling = false }
}
