import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { isReasonableIpcPayload } from '../security'

const CHANNEL = 'penny:sandbox:call'
const hosts = new Map<number, PluginSandbox>()
let registered = false

/** Each plugin has an ephemeral session and its own sandboxed renderer. */
export class PluginSandbox {
  private window: BrowserWindow
  private senderId: number
  private pending = new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>()
  private ready: (() => void) | null = null
  private failed: ((error: Error) => void) | null = null
  private stopped = false
  private requests = 0
  private inFlight = 0
  private epoch = Date.now()
  private heartbeat: ReturnType<typeof setInterval> | null = null
  canOpen = false

  constructor(
    private dispatch: (method: string, args: unknown[]) => Promise<unknown>,
    private onFailure: (message: string) => void,
  ) {
    if (app.commandLine.hasSwitch('no-sandbox')) throw new Error('Plugins require the Chromium sandbox. Restart Penny without --no-sandbox.')
    if (!registered) {
      ipcMain.handle(CHANNEL, async (event, method: unknown, args: unknown) => {
        const host = hosts.get(event.sender.id)
        if (!host || event.senderFrame !== event.sender.mainFrame ||
          typeof method !== 'string' || method.length > 64 || !Array.isArray(args) || !isReasonableIpcPayload(args) || JSON.stringify(args).length > 128_000) {
          throw new Error('Invalid plugin request.')
        }
        return host.request(method, args)
      })
      registered = true
    }
    const runtime = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'plugins', 'runtime')
    this.window = new BrowserWindow({
      show: false, width: 1, height: 1,
      webPreferences: {
        preload: path.join(runtime, 'preload.cjs'),
        partition: `penny-plugin-${randomUUID()}`,
        nodeIntegration: false, contextIsolation: true, sandbox: true,
        webSecurity: true, allowRunningInsecureContent: false,
        webviewTag: false, devTools: false, backgroundThrottling: false,
      },
    })
    const contents = this.window.webContents
    this.senderId = contents.id
    hosts.set(contents.id, this)
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    contents.session.setPermissionCheckHandler(() => false)
    contents.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('data:') && !details.url.startsWith('blob:') }))
    contents.session.on('will-download', (event) => event.preventDefault())
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => event.preventDefault())
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.on('render-process-gone', (_event, details) => this.fail(`Plugin process exited: ${details.reason}`))
    this.window.on('closed', () => { if (!this.stopped) this.fail('Plugin window closed unexpectedly.') })
  }

  private async request(method: string, args: unknown[]) {
    if (this.stopped) throw new Error('Plugin has stopped.')
    if (Date.now() - this.epoch >= 1000) { this.epoch = Date.now(); this.requests = 0 }
    if (++this.requests > 100 || this.inFlight >= 16) throw new Error('Plugin request limit exceeded.')
    if (method === 'ready') { this.canOpen = args[0] === true; this.ready?.(); return }
    if (method === 'failed') { this.fail(String(args[0]).slice(0, 2000)); return }
    if (method === 'reply') {
      const item = this.pending.get(String(args[0]))
      if (item) {
        clearTimeout(item.timer)
        this.pending.delete(String(args[0]))
        if (args[1]) item.reject(new Error(String(args[1]).slice(0, 2000)))
        else item.resolve()
      }
      return
    }
    this.inFlight++
    try { return await this.dispatch(method, args) }
    catch { throw new Error(`Plugin operation failed: ${method}`) }
    finally { this.inFlight-- }
  }

  async start(source: string) {
    const runtime = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'plugins', 'runtime')
    const [bootstrap, workerBridge] = await Promise.all([
      readFile(path.join(runtime, 'bootstrap.js'), 'utf8'),
      readFile(path.join(runtime, 'worker-bridge.js'), 'utf8'),
    ])
    const nonce = randomUUID()
    const workerSource = Buffer.from(`${workerBridge}\n;${bootstrap}\n;${source}\n;globalThis.startPennyPlugin()`).toString('base64')
    // Untrusted code runs only in a worker: it has no DOM or WebRTC constructors.
    // Blob workers inherit this document's restrictive CSP (including connect-src).
    const runner = `
      const code = new TextDecoder().decode(Uint8Array.from(atob('${workerSource}'), c => c.charCodeAt(0)));
      const worker = new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'})));
      window.pennyBridge.listen(message => worker.postMessage(message));
      worker.onmessage = async ({data}) => {
        try {
          const value = await window.pennyBridge.call(data.method, data.args);
          worker.postMessage({type: 'response', id: data.id, value});
        } catch (error) {
          worker.postMessage({type: 'response', id: data.id, error: String(error)});
        }
      };
      worker.onerror = () => window.pennyBridge.call('failed', ['Plugin worker failed. Check entry syntax.']);
    `
    const script = `<script nonce="${nonce}" src="data:text/javascript;base64,${Buffer.from(runner).toString('base64')}"></script>`
    const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'none'; worker-src blob:; frame-src 'none'; form-action 'none'; base-uri 'none'">${script}`
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail('Plugin activation timed out (10 seconds).'), 10_000)
      this.ready = () => { clearTimeout(timer); resolve() }
      this.failed = (error) => { clearTimeout(timer); reject(error) }
      this.window.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`).catch((error) => this.fail(String(error)))
    })
    this.ready = null
    this.failed = null
    this.heartbeat = setInterval(() => { this.command('ping', undefined, 3000).catch(() => {}) }, 5000)
  }

  event(name: string, payload?: unknown) {
    if (!this.stopped) this.window.webContents.send('penny:sandbox:message', { type: 'event', name, payload })
  }

  command(name: string, value?: string, timeout = 10_000) {
    if (this.stopped) return Promise.reject(new Error('Plugin has stopped.'))
    const id = randomUUID()
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => this.fail(`Plugin ${name} timed out.`), timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.window.webContents.send('penny:sandbox:message', { type: 'command', id, name, value })
    })
  }

  async stop() {
    if (this.stopped) return
    try { await this.command('stop', undefined, 1500) } catch { /* Force termination below. */ }
    this.destroy()
  }

  private fail(message: string) {
    if (this.stopped) return
    this.failed?.(new Error(message))
    this.destroy()
    this.onFailure(message)
  }

  destroy() {
    if (this.stopped) return
    this.stopped = true
    if (this.heartbeat) clearInterval(this.heartbeat)
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Plugin process stopped.'))
    }
    this.pending.clear()
    hosts.delete(this.senderId)
    if (!this.window.isDestroyed()) {
      this.window.destroy()
    }
  }
}
