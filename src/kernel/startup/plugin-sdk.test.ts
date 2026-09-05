import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'
import type { Context } from '../../../plugins/sdk'

async function sdk(activate: (context: Context) => unknown) {
  let receive: (message: unknown) => Promise<void> = async () => {}
  const calls: Array<{ method: string; args: unknown[] }> = []
  const world = {
    AbortController, setInterval, clearInterval,
    pennyBridge: {
      call: async (method: string, args: unknown[]) => {
        calls.push({ method, args })
        if (method === 'manifest') return { id: 'test', name: 'Test', permissions: ['ui'], runtime: 'sandbox' }
      },
      listen: (listener: typeof receive) => { receive = listener },
    },
    module: { exports: { activate } }, startPennyPlugin: async () => {},
  }
  // VM is only a browser-SDK test harness, not the production security boundary.
  runInNewContext(await readFile('plugins/runtime/bootstrap.js', 'utf8'), world)
  world.module.exports = { activate }
  await world.startPennyPlugin()
  return { calls, receive: (message: unknown) => receive(message) }
}
it('registers serializable UI and executes actions only when asked by the host', async () => {
  const action = vi.fn()
  const host = await sdk(async (context) => {
    await context.ui.register({ actions: [{ id: 'run', label: 'Run', run: action }] })
  })
  expect(host.calls.find((call) => call.method === 'ui.register')?.args).toEqual([{ panels: [], settings: [], actions: [{ id: 'run', label: 'Run' }] }])
  expect(action).not.toHaveBeenCalled()
  await host.receive({ type: 'command', id: '1', name: 'action', value: 'run' })
  expect(action).toHaveBeenCalledTimes(1)
  expect(host.calls.at(-1)).toEqual({ method: 'reply', args: ['1', null] })
})
it('runs cancellable jobs and records cancellation', async () => {
  let context!: Context
  const host = await sdk((value) => { context = value })
  const running = context.jobs.run('job', 'Example', (signal) => new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true })))
  await Promise.resolve()
  await host.receive({ type: 'command', id: 'cancel', name: 'cancel', value: 'job' })
  await running
  expect(host.calls.filter((call) => call.method === 'job').map((call) => (call.args[0] as { status: string }).status)).toEqual(['running', 'cancelled'])
})
it('aborts lifecycle and disposes resources in reverse order', async () => {
  const order: number[] = []
  let signal!: AbortSignal
  const host = await sdk((context) => {
    signal = context.lifecycle.signal
    context.lifecycle.add(() => { order.push(1) })
    context.lifecycle.add(() => { order.push(2) })
  })
  await host.receive({ type: 'command', id: 'stop', name: 'stop' })
  expect(signal.aborted).toBe(true)
  expect(order).toEqual([2, 1])
})
it('reports failed activation without signalling readiness', async () => {
  const host = await sdk(() => { throw new Error('broken example') })
  expect(host.calls.some((call) => call.method === 'failed')).toBe(true)
  expect(host.calls.some((call) => call.method === 'ready')).toBe(false)
})
