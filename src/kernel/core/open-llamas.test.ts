import type { Items } from '../../features/expeditions/model'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const A = 'a'.repeat(32)
const B = 'b'.repeat(32)
const HOLIDAY = 'CardPack:cardpack_event_holiday'
const MINI = 'CardPack:cardpack_basic_mini'

const mock = vi.hoisted(() => ({
  profiles: {} as Record<string, Items>,
  query: vi.fn(),
  open: vi.fn(),
  recycle: vi.fn(),
  send: vi.fn(),
  log: vi.fn(),
}))

vi.mock('../../services/endpoints/mcp', () => ({ getQueryProfile: mock.query, setOpenCardPackBatch: mock.open, setRecycleItemBatch: mock.recycle }))
vi.mock('../startup/accounts', () => ({
  AccountsManager: { getAccounts: () => new Map([[A, { accountId: A, displayName: 'Alpha' }], [B, { accountId: B, displayName: 'Beta' }]]) },
}))
vi.mock('./authentication', () => ({ Authentication: { verifyAccessToken: async (account: { accountId: string }) => `secret-token-${account.accountId.slice(0, 1)}` } }))
vi.mock('../startup/windows/main', () => ({ MainWindow: { instance: { isDestroyed: () => false, webContents: { send: mock.send } } } }))
vi.mock('./item-database', () => ({ ItemDatabase: { snapshot: async () => ({ records: {} }) } }))
vi.mock('../runtime-log', () => ({ RuntimeLog: { error: mock.log, info: vi.fn() } }))
// The real per-account queue, without its ledger file.
vi.mock('../startup/automation-history', () => ({ recordAutomationHistory: vi.fn() }))
vi.mock('../startup/data-directory', () => ({ DataDirectory: { autoExpeditionsFilePath: '/nonexistent/auto-expeditions.json' } }))

import { AutomationRewards } from '../startup/automation-rewards'
import { OpenLlamas } from './open-llamas'

function packs(templateId: string, count: number, prefix: string): Items {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}-${String(i).padStart(4, '0')}`, { templateId, quantity: 1 }]))
}

/** One fake campaign profile per account, served by the mocked endpoints. */
function serve() {
  mock.query.mockImplementation(async ({ accountId }: { accountId: string }) => ({
    data: { profileChanges: [{ profile: { accountId, items: JSON.parse(JSON.stringify(mock.profiles[accountId])) } }] },
  }))
  mock.open.mockImplementation(async ({ accountId, cardPackItemIds }: { accountId: string; cardPackItemIds: Array<string> }) => {
    const notifications = cardPackItemIds.map((id) => {
      if (!mock.profiles[accountId][id]) throw Object.assign(new Error('missing'), { response: { status: 400 } })
      delete mock.profiles[accountId][id]
      return { lootGranted: { items: [{ itemType: 'AccountResource:heroxp', quantity: 10 }] } }
    })
    return { data: { notifications } }
  })
}

async function settled(accountId: string) {
  await vi.waitFor(() => {
    const progress = OpenLlamas.status().find((entry) => entry.accountId === accountId)
    expect(progress && progress.status !== 'running' && progress.status !== 'waiting').toBe(true)
  })
  return OpenLlamas.status().find((entry) => entry.accountId === accountId)!
}

async function previewOf(accountId: string) {
  const result = await OpenLlamas.preview(accountId)
  if (!result.ok) throw new Error(result.error)
  return result.preview
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.profiles = { [A]: { ...packs(HOLIDAY, 30, 'a-holiday'), ...packs(MINI, 40, 'a-mini') }, [B]: packs(HOLIDAY, 5, 'b-holiday') }
  serve()
})

describe('OpenLlamas (main process)', () => {
  it('sends only included GUIDs, for the account that owns them', async () => {
    const preview = await previewOf(A)
    expect(OpenLlamas.start({ accountId: A, previewId: preview.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' })).toEqual({ ok: true })

    expect(await settled(A)).toMatchObject({ status: 'done', opened: 30, packsLeft: 40 })
    for (const [body] of mock.open.mock.calls) {
      expect(Object.keys(body).sort()).toEqual(['accessToken', 'accountId', 'cardPackItemIds'])
      expect(body.accountId).toBe(A)
      expect(body.cardPackItemIds.every((id: string) => id.startsWith('a-holiday-'))).toBe(true)
    }
    expect(Object.keys(mock.profiles[A]).filter((id) => id.startsWith('a-mini-'))).toHaveLength(40)
  })

  it('refuses a second run on the same account while one is going', async () => {
    let release = () => undefined as void
    mock.open.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ data: { notifications: [] } }))))
    const preview = await previewOf(A)
    expect(OpenLlamas.start({ accountId: A, previewId: preview.previewId, templateIds: [HOLIDAY], count: 1, recycle: 'none' }).ok).toBe(true)

    const again = await previewOf(A)
    expect(OpenLlamas.start({ accountId: A, previewId: again.previewId, templateIds: [HOLIDAY], count: 1, recycle: 'none' })).toEqual({
      ok: false,
      error: 'Llamas are already being opened on this account.',
    })

    await vi.waitFor(() => expect(mock.open).toHaveBeenCalledTimes(1))
    release()
    await settled(A)
  })

  it('keeps accounts apart: no preview, quote or profile crosses over', async () => {
    const previewA = await previewOf(A)

    // B has no preview of its own yet; A's id does not stand in for it.
    expect(OpenLlamas.start({ accountId: B, previewId: previewA.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(false)
    const previewB = await previewOf(B)
    expect(OpenLlamas.start({ accountId: B, previewId: previewA.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(false)

    // Both accounts may run at once, each on its own packs.
    expect(OpenLlamas.start({ accountId: A, previewId: previewA.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(true)
    expect(OpenLlamas.start({ accountId: B, previewId: previewB.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(true)
    expect(await settled(A)).toMatchObject({ opened: 30 })
    expect(await settled(B)).toMatchObject({ opened: 5 })
    for (const [body] of mock.open.mock.calls) {
      expect(body.cardPackItemIds.every((id: string) => id.startsWith(body.accountId === A ? 'a-' : 'b-'))).toBe(true)
    }

    // A profile answered for another account is refused outright.
    mock.query.mockResolvedValueOnce({ data: { profileChanges: [{ profile: { accountId: B, items: mock.profiles[B] } }] } })
    expect((await OpenLlamas.preview(A)).ok).toBe(false)
  })

  it('uses a preview once, and rejects unknown accounts and malformed requests', async () => {
    const preview = await previewOf(B)
    expect(OpenLlamas.start({ accountId: B, previewId: preview.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(true)
    await settled(B)
    expect(OpenLlamas.start({ accountId: B, previewId: preview.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' }).ok).toBe(false)

    expect((await OpenLlamas.preview('c'.repeat(32))).ok).toBe(false)
    expect((await OpenLlamas.preview('../QueryProfile')).ok).toBe(false)
    const fresh = await previewOf(B)
    expect(OpenLlamas.start({ accountId: B, previewId: fresh.previewId, templateIds: [], count: null, recycle: 'none' }).ok).toBe(false)
    expect(OpenLlamas.start(null).ok).toBe(false)
    expect(mock.open).toHaveBeenCalledTimes(1)
  })

  it('waits for Auto Llamas or Auto Expeditions on the same account to finish first', async () => {
    let finishAutomation = () => undefined as void
    const automation = AutomationRewards.withAccount(A, () => new Promise<void>((resolve) => (finishAutomation = resolve)))
    const preview = await previewOf(A)
    OpenLlamas.start({ accountId: A, previewId: preview.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mock.open).not.toHaveBeenCalled()
    expect(OpenLlamas.status().find((entry) => entry.accountId === A)?.status).toBe('waiting')

    finishAutomation()
    await automation
    expect(await settled(A)).toMatchObject({ status: 'done' })
  })

  it('stops between requests when asked, and never logs a token', async () => {
    mock.profiles[A] = packs(HOLIDAY, 100, 'a-holiday')
    let release = () => undefined as void
    mock.open.mockImplementationOnce(async ({ cardPackItemIds }: { cardPackItemIds: Array<string> }) => {
      await new Promise<void>((resolve) => (release = resolve))
      cardPackItemIds.forEach((id) => delete mock.profiles[A][id])
      return { data: { notifications: cardPackItemIds.map(() => ({ lootGranted: { items: [{ itemType: 'AccountResource:heroxp', quantity: 1 }] } })) } }
    })
    const preview = await previewOf(A)
    OpenLlamas.start({ accountId: A, previewId: preview.previewId, templateIds: [HOLIDAY], count: null, recycle: 'none' })
    await vi.waitFor(() => expect(mock.open).toHaveBeenCalledTimes(1))

    expect(OpenLlamas.cancel(A)).toBe(true)
    release()
    expect(await settled(A)).toMatchObject({ status: 'cancelled', opened: 25 })
    expect(mock.open).toHaveBeenCalledTimes(1)

    mock.query.mockRejectedValueOnce(Object.assign(new Error('boom'), { config: { headers: { Authorization: 'bearer secret-token-a' } }, response: { status: 503 } }))
    expect(await OpenLlamas.preview(A)).toEqual({ ok: false, error: "Could not read this account's llamas (HTTP 503). Try Refresh." })
    const sent = JSON.stringify([mock.log.mock.calls, mock.send.mock.calls])
    expect(sent).not.toContain('secret-token')
  })
})
