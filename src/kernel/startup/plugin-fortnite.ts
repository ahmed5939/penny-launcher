import { z } from 'zod'
import { dialog } from 'electron'
import { PLUGIN_FORTNITE_PROFILES } from '../../types/plugin-fortnite'
import { PluginBridge } from './plugin-api'
import { AccountsManager } from './accounts'
import { MainWindow } from './windows/main'
import { pluginLog, requirePluginPermission, type PluginRuntimeRecord } from './plugin-broker'
import { Authentication } from '../core/authentication'
import { baseGameService } from '../../services/config/base-game'
import { getPluginMCPPolicy, pluginMCPCatalog } from './plugin-fortnite-policy'
import { filterPluginLocker, filterPluginProfile } from './plugin-profile-data'

const accountIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
const requestSchema = z.object({ operation: z.string().min(1).max(80), profileId: z.enum(PLUGIN_FORTNITE_PROFILES), body: z.record(z.unknown()).default({}) }).strict()
const states = new WeakMap<PluginRuntimeRecord, { busy: boolean; readAt: number; writeAt: number }>()
const accountWrites = new Set<string>()
let reviewing = false

function stateFor(plugin: PluginRuntimeRecord) {
  let state = states.get(plugin)
  if (!state) { state = { busy: false, readAt: -Infinity, writeAt: -Infinity }; states.set(plugin, state) }
  return state
}

/** No service errors or authentication details may cross this boundary or enter plugin logs. */
async function service<T>(run: () => Promise<T>): Promise<T> {
  try { return await run() } catch { throw new Error('Fortnite service request failed. Its outcome may be unknown; refresh before retrying a command.') }
}

async function reviewCommand(detail: string, check: () => void) {
  const window = MainWindow.instance
  if (!window || window.isDestroyed()) throw new Error('Open Penny to review this command.')
  if (reviewing) throw new Error('Another Fortnite command is awaiting review.')
  reviewing = true
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), 60_000)
  const monitor = setInterval(() => { try { check() } catch { abort.abort() } }, 250)
  try {
    const response = await dialog.showMessageBox(window, {
      type: 'warning', title: 'Penny — Review Fortnite command',
      message: 'Allow this add-on to change your game profile?', detail,
      buttons: ['Cancel', 'Allow once'], defaultId: 0, cancelId: 0, noLink: true, signal: abort.signal,
    })
    check()
    return !abort.signal.aborted && response.response === 1
  } finally { clearTimeout(timeout); clearInterval(monitor); reviewing = false }
}

export async function dispatchFortnite(plugin: PluginRuntimeRecord, method: string, args: unknown[]) {
  if (method === 'mcp.operations') { z.tuple([]).parse(args); return pluginMCPCatalog() }
  if (!['mcp.queryProfile', 'mcp.request', 'eos.locker'].includes(method)) throw new Error('Unknown Fortnite operation.')
  const accountId = accountIdSchema.parse(args[0])
  const locker = method === 'eos.locker'
  const request = locker ? null : requestSchema.parse(method === 'mcp.queryProfile'
    ? { operation: 'QueryProfile', profileId: args[1], body: {} } : args[1])
  if (args.length !== (locker ? 1 : 2)) throw new Error('Unexpected Fortnite arguments.')
  const policy = request ? getPluginMCPPolicy(request.operation) : null
  const body = policy ? policy.body.parse(request!.body) : null
  if (request && !policy!.profiles.includes(request.profileId)) throw new Error('Operation does not support this profile.')
  const permissionMethod = locker ? 'eos.locker' : policy!.write ? 'mcp.write' : 'mcp.queryProfile'
  const host = plugin.host
  const revision = PluginBridge.getAccountScopeRevision()
  const check = () => {
    requirePluginPermission(plugin.manifest, permissionMethod)
    if (!host || plugin.host !== host) throw new Error('Plugin stopped or restarted.')
    const scope = PluginBridge.getAccountScope()
    if (revision !== PluginBridge.getAccountScopeRevision() || (scope.primary !== accountId && !scope.members.includes(accountId)) ||
      !AccountsManager.getAccountById(accountId)) throw new Error('Account scope changed or account is unavailable.')
    if (request && (!plugin.manifest.fortnite?.profiles.includes(request.profileId) ||
      !plugin.manifest.fortnite.operations.some((operation) => operation === request.operation))) throw new Error('Fortnite profile or operation was not declared for review.')
  }
  check()
  const account = AccountsManager.getAccountById(accountId)!
  const state = stateFor(plugin)
  if (state.busy) throw new Error('A Fortnite request is already running for this plugin.')
  const write = policy?.write === true
  if (write && accountWrites.has(accountId)) throw new Error('Another plugin command is pending for this account.')
  const now = Date.now()
  if (now - (write ? state.writeAt : state.readAt) < (write ? 30_000 : 2000)) throw new Error('Fortnite request is rate limited.')
  if (write) { state.writeAt = now; accountWrites.add(accountId) } else state.readAt = now
  state.busy = true
  try {
    if (write) {
      const detail = `Add-on: ${plugin.manifest.name}\nAccount: ${account.displayName} (${accountId})\nCommand: ${request!.operation}\nProfile: ${request!.profileId}\n\n${policy!.description}\n\nExact request:\n${JSON.stringify(body, null, 2)}\n\nThis approval applies once. Some changes cannot be undone.`
      if (!await reviewCommand(detail, check)) return { accountId, operation: request!.operation, profileId: request!.profileId, cancelled: true, applied: false }
    }
    if (locker) {
      const { eosToken } = await import('../core/locker')
      const { lockerService } = await import('../../services/config/locker')
      const { default: axios } = await import('axios')
      check()
      const accessToken = await service(() => eosToken(account))
      check()
      if (!accessToken) throw new Error('Account authentication is unavailable.')
      const adapter = axios.getAdapter(lockerService.defaults.adapter)
      const response = await service(() => lockerService.get(`/account/${encodeURIComponent(accountId)}/items`, {
        headers: { Authorization: `Bearer ${accessToken}` }, timeout: 20_000,
        maxRedirects: 0, maxContentLength: 1024 * 1024,
        adapter: (config) => { check(); return adapter(config) },
      }))
      check()
      return { accountId, ...filterPluginLocker(response.data) }
    }
    const accessToken = await service(() => Authentication.verifyAccessToken(account))
    check()
    if (!accessToken) throw new Error('Account authentication is unavailable.')
    // Interceptors run asynchronously. Recheck in the adapter, immediately before transport.
    const { default: axios } = await import('axios')
    const adapter = axios.getAdapter(baseGameService.defaults.adapter)
    check()
    const response = await service(() => baseGameService.post(
      `/profile/${encodeURIComponent(accountId)}/client/${request!.operation}`, body,
      { headers: { Authorization: `bearer ${accessToken}` }, params: { profileId: request!.profileId, rvn: -1 },
        timeout: 20_000, maxRedirects: 0, maxContentLength: 8 * 1024 * 1024, maxBodyLength: 32_000,
        adapter: (config) => { check(); return adapter(config) } },
    ))
    if (write) pluginLog(plugin, 'info', `Completed ${request!.operation} for ${accountId} after user confirmation.`)
    check()
    if (!write) return filterPluginProfile(response.data, accountId, request!.profileId)
    // Never return arbitrary notifications, multi-profile updates, headers or server errors.
    return { accountId, operation: request!.operation, profileId: request!.profileId, cancelled: false, applied: true }
  } finally { state.busy = false; if (write) accountWrites.delete(accountId) }
}
