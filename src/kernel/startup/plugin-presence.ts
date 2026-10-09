import { z } from 'zod'
import { PluginBridge } from './plugin-api'
import { pluginLog, requirePluginPermission, type PluginRuntimeRecord } from './plugin-broker'
import { loadPresence, presenceLoaded } from './presence-loader'

const accountIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
const limits = new WeakMap<PluginRuntimeRecord, number>()

function inScope(accountId: string | null) {
  const scope = PluginBridge.getAccountScope()
  return accountId !== null && (scope.primary === accountId || scope.members.includes(accountId))
}

/**
 * Native presence for add-ons: the same single session the Presence page drives.
 * PresenceManager validates the request and owns the tokens; add-ons only reach
 * sessions for accounts in the current selection.
 */
export async function dispatchPluginPresence(plugin: PluginRuntimeRecord, method: string, args: unknown[]) {
  requirePluginPermission(plugin.manifest, method)
  const host = plugin.host
  const alive = () => { if (!host || plugin.host !== host) throw new Error('Plugin stopped or restarted.') }
  if (method === 'presence.status') {
    z.tuple([]).parse(args)
    // Nothing has loaded presence yet, so nothing can be running.
    if (!presenceLoaded()) return null
    const snapshot = (await loadPresence()).PresenceManager.status()
    alive()
    return snapshot.accountId === null || inScope(snapshot.accountId) ? snapshot : null
  }
  if (Date.now() - (limits.get(plugin) ?? -Infinity) < 2000) throw new Error('Presence request is rate limited.')
  limits.set(plugin, Date.now())
  const { PresenceManager } = await loadPresence()
  alive()
  if (method === 'presence.stop') {
    z.tuple([]).parse(args)
    const running = PresenceManager.status().accountId
    if (running !== null && !inScope(running)) throw new Error('Presence is running for an account outside the current scope.')
    const result = await PresenceManager.stop()
    pluginLog(plugin, 'info', 'Stopped presence.')
    return result
  }
  if (method !== 'presence.start' && method !== 'presence.update') throw new Error('Unknown presence operation.')
  const [request] = z.tuple([z.object({ accountId: accountIdSchema }).passthrough()]).parse(args)
  if (!inScope(request.accountId)) throw new Error('Account is outside the current scope.')
  const result = method === 'presence.start' ? await PresenceManager.start(request) : await PresenceManager.update(request)
  alive()
  if (result.ok) pluginLog(plugin, 'info', `${method === 'presence.start' ? 'Started' : 'Updated'} presence for ${request.accountId}.`)
  return result
}
