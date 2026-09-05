/* Browser-only SDK: this runs beside plugin code, never with Node privileges. */
(() => {
  const window = globalThis
  const bridge = window.pennyBridge
  const call = (method, ...args) => bridge.call(method, args)
  const abort = new AbortController()
  const cleanups = new Set()
  const listeners = new Map()
  const actions = new Map()
  const jobs = new Map()
  let controller
  const report = (error) => call('log', 'error', String(error)).catch(() => {})
  const context = {
    apiVersion: 4,
    log: (message) => call('log', 'info', String(message)),
    accounts: {
      list: () => call('accounts.list'),
      getScoped: () => call('accounts.scope'),
      quests: (accountId) => call('accounts.quests', accountId),
    },
    storage: {
      get: (key, fallback) => call('storage.get', key, fallback),
      set: (key, value) => call('storage.set', key, value),
      delete: (key) => call('storage.delete', key),
      all: () => call('storage.all'),
    },
    settings: { get: () => call('settings.get') },
    openRoute: (route) => call('navigate', route),
    openExternal: (url) => call('external', url),
    notifications: { show: (title, body) => call('notify', title, body) },
    events: {
      on: (name, listener) => {
        if (!['accounts-changed', 'account-scope-changed', 'settings-changed', 'plugin-settings-changed'].includes(name)) throw new Error('Unknown event')
        if (!listeners.has(name)) listeners.set(name, new Set())
        listeners.get(name).add(listener)
        return () => listeners.get(name).delete(listener)
      },
    },
    lifecycle: {
      signal: abort.signal,
      add: (cleanup) => { cleanups.add(cleanup); return () => cleanups.delete(cleanup) },
    },
    timers: {
      every: (callback, milliseconds) => {
        if (!Number.isFinite(milliseconds) || milliseconds < 1000 || milliseconds > 2147483647) throw new Error('Invalid interval')
        let busy = false
        const timer = setInterval(async () => {
          if (busy || abort.signal.aborted) return
          busy = true
          try { await callback() } catch (error) { report(error) } finally { busy = false }
        }, milliseconds)
        const cancel = () => { clearInterval(timer); cleanups.delete(cancel) }
        cleanups.add(cancel)
        return cancel
      },
    },
    ui: {
      register: async ({ panels = [], settings = [], actions: entries = [] }) => {
        await call('ui.register', { panels, settings, actions: entries.map(({ id, label }) => ({ id, label })) })
        actions.clear()
        for (const action of entries) actions.set(action.id, action.run)
      },
      getSettings: () => call('ui.settings'),
    },
    jobs: {
      run: async (id, label, task) => {
        if (jobs.has(id)) throw new Error('Job already running')
        const cancellation = new AbortController()
        jobs.set(id, cancellation)
        try {
          await call('job', { id, label, status: 'running' })
          if (!cancellation.signal.aborted) await task(cancellation.signal)
          await call('job', { id, label, status: cancellation.signal.aborted ? 'cancelled' : 'completed' })
        } catch (error) {
          await call('job', { id, label, status: cancellation.signal.aborted ? 'cancelled' : 'error', error: String(error) })
        } finally { jobs.delete(id) }
      },
    },
  }
  bridge.listen(async (message) => {
    if (message.type === 'event') {
      for (const listener of listeners.get(message.name) || []) {
        Promise.resolve().then(() => listener(message.payload)).catch(report)
      }
      return
    }
    if (message.type !== 'command') return
    try {
      if (message.name === 'open') await controller?.open?.()
      else if (message.name === 'action') {
        const action = actions.get(message.value)
        if (!action) throw new Error('Unknown action')
        await action()
      } else if (message.name === 'cancel') jobs.get(message.value)?.abort()
      else if (message.name === 'stop') {
        abort.abort()
        for (const job of jobs.values()) job.abort()
        try { await controller?.deactivate?.() }
        finally {
          for (const cleanup of [...cleanups].reverse()) {
            try { await cleanup() } catch (error) { report(error) }
          }
          cleanups.clear()
        }
      }
      await call('reply', message.id, null)
    } catch (error) { await call('reply', message.id, String(error)) }
  })
  window.startPennyPlugin = async () => {
    try {
      if (typeof window.module?.exports?.activate !== 'function') throw new Error('Export activate(context)')
      context.manifest = await call('manifest')
      controller = await window.module.exports.activate(context)
      await call('ready', typeof controller?.open === 'function')
    } catch (error) { await call('failed', String(error)) }
  }
  window.module = { exports: {} }
})()
