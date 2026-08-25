/** Throwaway harness. Delete with preview.html and .preview/. */
import relativeTime from 'dayjs/plugin/relativeTime'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import dayjs from 'dayjs'
import { createRoot } from 'react-dom/client'

const sent: Array<any> = []
;(window as any).__sent = sent

const listeners: Record<string, Array<(p: any) => void>> = {}
const on = (c: string) => (cb: (p: any) => Promise<void>) => {
  listeners[c] = [...(listeners[c] ?? []), cb]
  return { removeListener: () => {} }
}
const emit = (c: string, p: any) => (listeners[c] ?? []).forEach((cb) => cb(p))
;(window as any).__emit = emit

;(window as any).electronAPI = {
  responseItemDatabase: on('db'),
  requestItemDatabase: () => {},
  responseInventory: on('inv'),
  requestInventory: () => emit('inv', invPayload),
  recycleInventoryItems: (_a: any, s: any) =>
    sent.push({ api: 'recycle', s }),
  notificationInventoryRecycle: on('rec'),
  performItemAction: (_a: any, r: any) => sent.push({ api: 'itemAction', r }),
  notificationItemAction: on('act'),
}

import './src/globals.css'
import { localeReady } from './src/locale'
import { useAccountListStore } from './src/state/accounts/list'
import { useAccountScopeStore } from './src/state/accounts/scope'
import { useItemDatabaseStore } from './src/state/items/database'
import { RouteComponent as VaultPage } from './src/routes/stw-operations/inventory/-page'

dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)

const a1 = 'acc-1'

useAccountListStore.setState({
  accounts: {
    [a1]: { accountId: a1, deviceId: 'd', displayName: 'PennyMain', secret: 's' },
  } as any,
  idsList: [a1],
  selected: a1,
} as any)

useAccountScopeStore.setState({ primary: a1, members: [a1], mode: 'single' } as any)

const mk = (
  itemId: string,
  templateId: string,
  kind: string,
  rarity: string,
  tier: number,
  level: number,
  locked: string | null
) => ({
  itemId,
  templateId,
  kind,
  name: templateId,
  subtitle: null,
  rarity,
  tier,
  level,
  quantity: 1,
  lockedReason: locked,
  personality: null,
  setBonus: null,
  alterations: [],
})

const invPayload = {
  [a1]: {
    accountId: a1,
    items: [
      mk('g1', 'Defender:did_defenderassault_basic_r_t03', 'defender', 'rare', 3, 20, null),
      mk('g2', 'Defender:did_defendersniper_basic_sr_t05', 'defender', 'legendary', 5, 40, 'favorite'),
      mk('g3', 'Worker:workerbasic_uc_t02', 'survivor', 'uncommon', 2, 12, null),
    ],
  },
}

const base =
  'https://raw.githubusercontent.com/PegLegFN/PegLegResources/major/GameAssets'

const fileName = (v?: string) =>
  typeof v === 'string' ? (v.split(/[\\/]/).pop() ?? null) : null

async function load() {
  const records: Record<string, any> = {}

  const [ratings] = await Promise.all([
    fetch(`${base}/ItemRatings.json`).then((r) => r.json()),
    ...['Defender', 'Worker', 'AccountResource'].map(async (f) => {
      const json = await (await fetch(`${base}/NamedItems/${f}.json`)).json()

      Object.entries<any>(json).forEach(([id, item]) => {
        if (!item?.DisplayName) return
        records[id.toLowerCase()] = {
          name: item.DisplayName,
          subType: item.SubType ?? null,
          description: item.Description ?? null,
          rarity: item.Rarity ?? null,
          tier: item.Tier ?? 0,
          image: fileName(item.ImagePaths?.SmallPreview),
          largeImage: fileName(item.ImagePaths?.LargePreview),
          category: null,
          displayTier: null,
          recycle: item.RecycleRecipe?.Result
            ? { amount: item.RecycleRecipe.Amount ?? 0, result: item.RecycleRecipe.Result }
            : null,
          perk: null, commanderPerk: null, abilities: [],
          craftingCost: {}, tierUpCost: {}, objectives: [], rewards: [],
          upgradeCost: {}, upgradeResult: null, alterationRow: null,
        }
      })
    }),
  ])

  useItemDatabaseStore.getState().update({
    alterationPools: {},
    fetchedAt: new Date().toISOString(),
    ratings,
    records,
    total: Object.keys(records).length,
  })
}

const root = createRoot(document.getElementById('app')!)

load()
  .catch((e) => console.error(e))
  .then(() =>
    localeReady.finally(() =>
      root.render(
        <div className="mx-auto max-w-6xl p-8">
          <VaultPage />
        </div>
      )
    )
  )
