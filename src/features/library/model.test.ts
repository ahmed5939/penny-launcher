import type { CatalogItem } from './model'

import { describe, expect, it } from 'vitest'

import {
  appTitles,
  buildLibrary,
  cloudSaveDownloads,
  cloudSaveLogSample,
  formatBytes,
  fortniteMainItemId,
  fortniteModes,
  itemKind,
  normaliseStoreOffers,
  offerOwned,
  parseCloudSaves,
  parseEntitlements,
  pickArt,
  purchaseItemIds,
  safeSaveSegments,
  sizedArt,
  splitSaveKey,
  storeRegion,
  trimCatalogItem,
} from './model'

const art = (name: string) => [
  { type: 'DieselGameBoxTall', url: `https://cdn1.epicgames.com/item/fn/${name}-tall` },
  { type: 'DieselGameBox', url: `https://cdn1.epicgames.com/item/fn/${name}-wide` },
]

const launchable = [{ path: 'addons/launchable' }, { path: 'addons' }, { path: 'games/experience' }]

/** Fortnite's main item as the catalogue returns it, cut down to what is read. */
const mainItem: CatalogItem = {
  id: fortniteMainItemId,
  title: 'Fortnite',
  entitlementName: 'Fortnite',
  releaseInfo: [{ appId: 'Fortnite' }],
  dlcItemList: [
    { id: 'br', title: 'Fortnite Battle Royale', entitlementName: 'br', categories: launchable, keyImages: art('br'), releaseInfo: [{ appId: 'afdb5a85' }] },
    { id: 'f205453fa3384a61a9b40ff76279bef2', title: 'Fortnite Save the World', entitlementName: 'f205453fa3384a61a9b40ff76279bef2', categories: launchable, keyImages: art('stw'), releaseInfo: [{ appId: 'f60bd71e' }], customAttributes: { AdditionalCommandLine: { type: 'STRING', value: '-epicapp=Fortnite -IslandOverride=campaign' } } },
    { id: '0b41f0192f7f4f2691684581aedc0778', title: 'Fortnite Save the World Content', categories: [{ path: 'hidden' }], releaseInfo: [{ appId: 'aa31f9e9' }], customAttributes: { AdditionalCommandLine: { type: 'STRING', value: '-epicapp=Fortnite -IslandOverride=campaign' } } },
    { id: 'festival', title: 'Fortnite Festival', entitlementName: 'festival', categories: launchable, keyImages: art('festival') },
    { id: 'lego-content', title: 'LEGO® Fortnite Content', entitlementName: 'lego-content', categories: [{ path: 'hidden' }] },
  ],
}

const entitlement = (overrides: Record<string, unknown>) => ({
  id: `e-${Math.random().toString(16).slice(2)}`,
  namespace: 'fn',
  entitlementType: 'ENTITLEMENT',
  grantDate: '2020-01-01T00:00:00.000Z',
  active: true,
  status: 'ACTIVE',
  ...overrides,
})

describe('library model — entitlements and the catalogue', () => {
  it('reads entitlements defensively', () => {
    const parsed = parseEntitlements([
      entitlement({ catalogItemId: 'a', entitlementName: 'A' }),
      entitlement({ catalogItemId: 'b', active: false }),
      entitlement({ catalogItemId: 'c', status: 'REVOKED' }),
      { entitlementName: 'only-a-name', namespace: 'fn', created: '2019-05-05T00:00:00Z' },
      { namespace: 'fn' },
      null,
      'nonsense',
    ])

    expect(parsed.map((e) => [e.catalogItemId || e.entitlementName, e.active])).toEqual([
      ['a', true],
      ['b', false],
      ['c', false],
      ['only-a-name', true],
    ])
    expect(parsed[3].grantDate).toBe('2019-05-05T00:00:00.000Z')
    expect(parseEntitlements({ elements: [] })).toEqual([])
  })

  it('lists launchable modes and leaves the hidden content items out', () => {
    expect(fortniteModes(mainItem).map((item) => item.id)).toEqual(['br', 'f205453fa3384a61a9b40ff76279bef2', 'festival'])
    expect(fortniteModes(null)).toEqual([])
  })

  it('lists each mode with the app ids its time is recorded under, and finds Save the World', () => {
    const library = buildLibrary('acc', [], mainItem, {})

    expect(library.fortnite.modes.map((mode) => [mode.title, mode.appIds, mode.saveTheWorld])).toEqual([
      ['Fortnite Battle Royale', ['afdb5a85'], false],
      // The hidden content item starts the same island: its record is the mode's too.
      ['Fortnite Save the World', ['f60bd71e', 'aa31f9e9'], true],
      ['Fortnite Festival', [], false],
    ])
    expect(library.fortnite.modes[0].art.tall).toBe('https://cdn1.epicgames.com/item/fn/br-tall')
    expect(library.fortnite.saveTheWorld.art.wide).toBe('https://cdn1.epicgames.com/item/fn/stw-wide')
  })

  it('takes Save the World access from the game profile, and entitlements only as a fallback', () => {
    const founder = parseEntitlements([
      entitlement({ catalogItemId: '4217759881dd43209da2e89a9552a9a6', entitlementName: 'Fortnite_Founder', grantDate: '2019-01-15T00:00:00Z' }),
    ])
    const profile = (campaignAccess: boolean, founderTier: number | null) => ({ campaignAccess, created: null, founderTier, tutorialComplete: true })

    expect(buildLibrary('acc', founder, mainItem, {}, { profile: profile(true, 2) }).fortnite.saveTheWorld).toMatchObject({
      access: true,
      source: 'profile',
      founder: { edition: 'Deluxe' },
      founderSince: '2019-01-15T00:00:00.000Z',
    })
    // The store's Save the World offer reads as owned with access, entitlement or not.
    expect(buildLibrary('acc', [], mainItem, {}, { profile: profile(true, null) }).fortnite.ownedItemIds).toContain(
      'f205453fa3384a61a9b40ff76279bef2'
    )
    expect(buildLibrary('acc', [], mainItem, {}, { profile: profile(false, null) }).fortnite.ownedItemIds).toEqual([])
    // The profile is the authority, even over an entitlement.
    expect(buildLibrary('acc', founder, mainItem, {}, { profile: profile(false, null) }).fortnite.saveTheWorld.access).toBe(false)
    // A non-Founder with access: what no entitlement could show.
    expect(buildLibrary('acc', [], mainItem, {}, { profile: profile(true, null) }).fortnite.saveTheWorld).toMatchObject({ access: true, founder: null })
    // Without the profile an entitlement shows access, but nothing shows its absence.
    expect(buildLibrary('acc', founder, mainItem, {}).fortnite.saveTheWorld).toMatchObject({ access: true, source: 'entitlements', founder: { edition: null } })
    expect(buildLibrary('acc', [], mainItem, {}).fortnite.saveTheWorld).toMatchObject({ access: null, source: null, founder: null })

    const revoked = parseEntitlements([entitlement({ catalogItemId: 'f205453fa3384a61a9b40ff76279bef2', active: false })])

    expect(buildLibrary('acc', revoked, mainItem, {}).fortnite.saveTheWorld.access).toBeNull()

    const hiddenContent = parseEntitlements([entitlement({ catalogItemId: '0b41f0192f7f4f2691684581aedc0778' })])
    const withoutCatalogue = buildLibrary('acc', hiddenContent, null, {})

    expect(withoutCatalogue.fortnite.saveTheWorld.access).toBe(true)
    expect(withoutCatalogue.fortnite.modes).toEqual([])
    expect(withoutCatalogue.fortnite.purchases).toEqual([])
  })

  it('turns the remaining Fortnite entitlements into purchases, grouped and newest first', () => {
    const entitlements = parseEntitlements([
      entitlement({ catalogItemId: fortniteMainItemId, entitlementName: 'Fortnite' }),
      entitlement({ catalogItemId: 'br' }),
      entitlement({ catalogItemId: 'lego-content' }),
      entitlement({ catalogItemId: 'pack', grantDate: '2019-02-01T00:00:00Z' }),
      entitlement({ catalogItemId: 'vbucks', grantDate: '2021-06-01T00:00:00Z' }),
      entitlement({ catalogItemId: 'vbucks', grantDate: '2022-06-01T00:00:00Z' }),
      entitlement({ catalogItemId: 'mystery', entitlementName: '0123456789abcdef0123456789abcdef', active: false, grantDate: '2018-01-01T00:00:00Z' }),
      entitlement({ catalogItemId: 'other-game', namespace: 'sugar' }),
      entitlement({ catalogItemId: 'other-game-2', namespace: 'sugar' }),
      entitlement({ catalogItemId: 'third', namespace: 'calluna' }),
      entitlement({ catalogItemId: 'gone', namespace: 'calluna', active: false }),
    ])

    expect(purchaseItemIds(entitlements, mainItem).sort()).toEqual(['mystery', 'pack', 'vbucks'])

    const library = buildLibrary('acc', entitlements, mainItem, {
      pack: { id: 'pack', title: 'Founder’s Pack', description: 'Save the World access', categories: [{ path: 'bundles' }], keyImages: [{ type: 'OfferImageWide', url: 'https://cdn2.unrealengine.com/pack.jpg' }] },
      vbucks: { id: 'vbucks', title: '1,000 V-Bucks', categories: [{ path: 'points' }] },
      mystery: null,
    })
    const purchases = library.fortnite.purchases

    expect(purchases.map((p) => [p.title, p.group])).toEqual([
      ['1,000 V-Bucks', 'purchase'],
      ['Founder’s Pack', 'purchase'],
      ['Unlisted item', 'reward'],
    ])
    expect(purchases[0]).toMatchObject({ count: 2, grantDate: '2021-06-01T00:00:00.000Z', lastGrantDate: '2022-06-01T00:00:00.000Z', kind: 'vbucks', resolved: true })
    expect(purchases[1]).toMatchObject({ kind: 'pack', art: { wide: 'https://cdn2.unrealengine.com/pack.jpg', tall: null }, description: 'Save the World access' })
    expect(purchases[2]).toMatchObject({ active: false, resolved: false })
    expect(library.fortnite.ownedItemIds).toContain('vbucks')
    expect(library.fortnite.ownedItemIds).not.toContain('mystery')
    // No library list was read: the games are unknown, not none.
    expect(library.games).toBeNull()
  })

  it('names grants from the store, groups them, and spells out codenamed V-Bucks', () => {
    const entitlements = parseEntitlements([
      entitlement({ catalogItemId: '48ff3f41680e403bb2717737f68731c5', entitlementName: 'Fortnite_Free', grantDate: '2018-06-16T00:00:00Z' }),
      entitlement({ catalogItemId: 'juno', entitlementName: 'FN_Juno_AddOn' }),
      entitlement({ catalogItemId: 'brite', entitlementName: 'JUNO_S29_StarterPack', grantDate: '2025-06-29T00:00:00Z' }),
      entitlement({ catalogItemId: 'seasalt', entitlementName: 'FN_Seasalt' }),
      entitlement({ catalogItemId: 'raf', entitlementName: 'FN_RaF3_Spray' }),
      entitlement({ catalogItemId: 'sugar', entitlementName: 'FN_Sugar_1' }),
      entitlement({ catalogItemId: 'uefn', entitlementName: 'x', entitlementType: 'AUDIENCE' }),
    ])
    const offers = normaliseStoreOffers({
      data: {
        Catalog: {
          catalogOffers: {
            elements: [
              { id: 'o1', title: 'LEGO® Fortnite: Odyssey', offerType: 'EXPERIENCE', items: [{ id: 'juno' }], keyImages: [{ type: 'OfferImageTall', url: 'https://cdn1.epicgames.com/offer/fn/lego-tall' }] },
              { id: 'o2', title: 'Operation Brite Starter Pack', offerType: null, items: [{ id: 'brite' }], keyImages: [{ type: 'OfferImageTall', url: 'https://cdn1.epicgames.com/offer/fn/brite-tall' }] },
              // An internal offer for the same item names nothing.
              { id: 'o3', title: 'Internal brite grant', offerType: 'OTHERS', items: [{ id: 'brite' }] },
            ],
          },
        },
      },
    })
    const library = buildLibrary(
      'acc',
      entitlements,
      mainItem,
      {
        '48ff3f41680e403bb2717737f68731c5': { id: '48ff3f41680e403bb2717737f68731c5', title: 'Free audience access item', categories: [{ path: 'bundles' }] },
        juno: { id: 'juno', title: 'Juno AddOn', categories: [{ path: 'testing' }] },
        brite: { id: 'brite', title: 'Operation Brite Starter Pack', categories: [{ path: 'testing' }] },
        seasalt: { id: 'seasalt', title: 'Seasalt', categories: [{ path: 'points/packs' }, { path: 'points' }] },
        raf: { id: 'raf', title: 'RaF3 Spray', categories: [{ path: 'testing' }] },
        sugar: { id: 'sugar', title: 'FN Sugar 1', categories: [{ path: 'testing' }] },
        uefn: { id: 'uefn', title: 'UEFN Free Audience', categories: [{ path: 'audience' }] },
      },
      { offers }
    )
    const byId = Object.fromEntries(library.fortnite.purchases.map((p) => [p.catalogItemId, p]))

    expect(byId['48ff3f41680e403bb2717737f68731c5']).toMatchObject({ group: 'access', title: 'Fortnite', internalName: 'Free audience access item' })
    expect(byId.juno).toMatchObject({ group: 'access', title: 'LEGO® Fortnite: Odyssey', internalName: 'Juno AddOn' })
    expect(byId.juno.art.tall).toBe('https://cdn1.epicgames.com/offer/fn/lego-tall')
    expect(byId.brite).toMatchObject({ group: 'purchase', kind: 'pack', internalName: null })
    expect(byId.brite.art.tall).toBe('https://cdn1.epicgames.com/offer/fn/brite-tall')
    expect(byId.seasalt).toMatchObject({ group: 'purchase', kind: 'vbucks', title: 'V-Bucks pack', internalName: 'Seasalt' })
    expect(byId.raf).toMatchObject({ group: 'reward', source: 'Refer a Friend' })
    expect(byId.sugar).toMatchObject({ group: 'reward', source: 'Rocket League' })
    expect(byId.uefn).toMatchObject({ group: 'access' })
  })

  it('classifies items, subscriptions before packs', () => {
    expect(itemKind(['subscription', 'addons/durable'], 'Fortnite Crew')).toBe('subscription')
    expect(itemKind(['points/packs', 'addons/consumable'], '2,800 V-Bucks')).toBe('vbucks')
    expect(itemKind(['addons', 'addons/durable'], 'Batman Caped Crusader Pack', 'OTHERS')).toBe('pack')
    expect(itemKind(['games', 'applications'], 'Founder Access Audience')).toBe('access')
    expect(itemKind(['applications/prod/content'], 'Celestial Outfit skin')).toBe('other')
  })

  it('only takes art from the hosts the CSP allows, and asks for a resized copy', () => {
    expect(pickArt([
      { type: 'OfferImageTall', url: 'http://cdn1.epicgames.com/insecure' },
      { type: 'Thumbnail', url: 'https://cdn1.epicgames.com/thumb' },
      { type: 'OfferImageWide', url: 'https://evil.example.com/wide' },
      { type: 'featuredMedia', url: 'https://cdn2.unrealengine.com/featured' },
    ])).toEqual({ tall: 'https://cdn1.epicgames.com/thumb', wide: 'https://cdn2.unrealengine.com/featured' })
    expect(pickArt(undefined)).toEqual({ tall: null, wide: null })
    expect(sizedArt('https://cdn1.epicgames.com/a', 300, 400)).toBe('https://cdn1.epicgames.com/a?w=300&h=400&resize=1&quality=medium')
    expect(sizedArt('https://cdn1.epicgames.com/a?x=1', 300, 400)).toBe('https://cdn1.epicgames.com/a?x=1')
    expect(sizedArt(null, 300, 400)).toBeNull()
  })

  it('names cloud-save apps from the release info and trims items for the disk cache', () => {
    expect(appTitles(mainItem)).toMatchObject({ Fortnite: 'Fortnite', afdb5a85: 'Fortnite Battle Royale' })

    const trimmed = trimCatalogItem({ ...mainItem, keyImages: [...art('x'), { type: 'AndroidIcon', url: 'https://cdn1.epicgames.com/icon' }], customAttributes: { FolderName: { value: 'Fortnite' } } })

    expect(trimmed.keyImages?.map((image) => image.type)).toEqual(['DieselGameBoxTall', 'DieselGameBox'])
    expect(trimmed.customAttributes).toBeUndefined()
    expect(trimmed.dlcItemList?.[1].customAttributes?.AdditionalCommandLine?.value).toContain('campaign')
  })
})

describe('library model — store', () => {
  const response = {
    data: {
      Catalog: {
        catalogOffers: {
          elements: [
            { id: 'legacy', title: '400 V-Bucks (Comp)', offerType: 'OTHERS', keyImages: [], items: [{ id: 'comp' }], categories: [{ path: 'points' }], price: { totalPrice: { discountPrice: 0, originalPrice: 0, currencyCode: 'USD', fmtPrice: { originalPrice: '0', discountPrice: '0' } } } },
            { id: 'pack', title: 'Mainframe Break Pack', offerType: 'ADD_ON', expiryDate: '2026-12-04T00:00:00.000Z', keyImages: [{ type: 'OfferImageTall', url: 'https://cdn1.epicgames.com/offer/fn/pack' }], items: [{ id: 'pack-item' }], categories: [{ path: 'addons/durable' }], price: { totalPrice: { discountPrice: 719, originalPrice: 899, currencyCode: 'USD', fmtPrice: { originalPrice: '$8.99', discountPrice: '$7.19' } } } },
            { id: 'stw', title: 'Fortnite Save the World', offerType: 'EXPERIENCE', keyImages: [{ type: 'OfferImageWide', url: 'https://cdn2.unrealengine.com/stw.jpg' }], items: [{ id: 'f205453fa3384a61a9b40ff76279bef2' }], categories: [{ path: 'games/experience' }], price: { totalPrice: { discountPrice: 0, originalPrice: 0, currencyCode: 'USD', fmtPrice: { originalPrice: '0', discountPrice: '0' } } } },
            { id: 'crew', title: 'Fortnite Crew', offerType: null, keyImages: [{ type: 'Thumbnail', url: 'https://cdn1.epicgames.com/offer/fn/crew' }], items: [{ id: 'crew-item' }], categories: [{ path: 'subscription' }], price: null },
            { title: 'No id' },
          ],
        },
      },
    },
  }

  it('normalises offers, listed ones first, with prices and kinds', () => {
    const offers = normaliseStoreOffers(response)

    expect(offers.map((offer) => [offer.id, offer.kind, offer.listed])).toEqual([
      ['pack', 'pack', true],
      ['stw', 'other', true],
      ['crew', 'other', true],
      ['legacy', 'vbucks', false],
    ])
    expect(offers[0].price).toMatchObject({ original: 899, discount: 719, formattedOriginal: '$8.99', formattedDiscount: '$7.19', discounted: true, free: false })
    expect(offers[0].expiryDate).toBe('2026-12-04T00:00:00.000Z')
    expect(offers[1].price).toMatchObject({ free: true, discounted: false })
    expect(offers[1].price?.formattedDiscount).not.toBe('0')
    expect(offers[2].price).toBeNull()
    expect(normaliseStoreOffers({ errors: [{ message: 'nope' }] })).toEqual([])
  })

  it('marks an offer owned when the account holds any of its items', () => {
    const owned = new Set(['f205453fa3384a61a9b40ff76279bef2'])
    const offers = normaliseStoreOffers(response)

    expect(offers.filter((offer) => offerOwned(offer, owned)).map((offer) => offer.id)).toEqual(['stw'])
  })

  it('takes the region from the OS and falls back to the US store', () => {
    expect(storeRegion('gb', 'en-GB')).toEqual({ country: 'GB', locale: 'en-GB' })
    expect(storeRegion('', 'de_de')).toEqual({ country: 'US', locale: 'de-DE' })
    expect(storeRegion(undefined, 'C.UTF-8')).toEqual({ country: 'US', locale: 'en-US' })
    expect(storeRegion('XYZ', 'fr')).toEqual({ country: 'US', locale: 'fr' })
  })
})

describe('library model — cloud saves', () => {
  const accountId = 'abc123'
  const listing = {
    files: {
      [`${accountId}/Fortnite/manifests/save.manifest`]: { size: 1200, lastModified: '2026-09-01T10:00:00.000Z', readLink: 'https://storage.example.com/a?Signature=secret' },
      [`/${accountId}/Fortnite/ChunksV4/00/abc.chunk`]: { size: '2048', lastModified: '2026-09-02T10:00:00.000Z', readLink: 'https://storage.example.com/b?Signature=secret' },
      [`${accountId}/Sugar/profile.sav`]: { length: 10, lastModified: '2025-01-01T00:00:00.000Z' },
      [`${accountId}/loose.sav`]: { size: 1 },
    },
    maxFileSizeBytes: 104857600,
    maxFolderSizeBytes: 524288000,
    folderThrottled: false,
    expiresAt: '2026-10-02T01:00:00.000Z',
  }

  it('splits keys by the account id wherever it sits', () => {
    expect(splitSaveKey(`${accountId}/Fortnite/a/b.sav`, accountId)).toEqual({ appName: 'Fortnite', path: 'a/b.sav' })
    expect(splitSaveKey(`/${accountId.toUpperCase()}/Fortnite/x`, accountId)).toEqual({ appName: 'Fortnite', path: 'x' })
    expect(splitSaveKey('Fortnite/x', accountId)).toEqual({ appName: 'Fortnite', path: 'x' })
    expect(splitSaveKey(`${accountId}/only-one`, accountId)).toBeNull()
  })

  it('groups files by game, newest sync first, with sizes and limits', () => {
    const parsed = parseCloudSaves(listing, accountId, { Fortnite: 'Fortnite' })

    expect(parsed.games.map((game) => [game.appName, game.title, game.files.length, game.totalSize, game.downloadable])).toEqual([
      ['Fortnite', 'Fortnite', 2, 3248, true],
      ['Sugar', null, 1, 10, false],
    ])
    expect(parsed.games[0].lastModified).toBe('2026-09-02T10:00:00.000Z')
    expect(parsed.games[0].files.map((file) => file.path)).toEqual(['ChunksV4/00/abc.chunk', 'manifests/save.manifest'])
    expect(parsed.limits).toEqual({ maxFileSizeBytes: 104857600, maxFolderSizeBytes: 524288000 })
    expect(parseCloudSaves(null, accountId)).toEqual({ games: [], limits: { maxFileSizeBytes: null, maxFolderSizeBytes: null }, folderThrottled: false })
  })

  it('keeps download links for one game only, and only https ones', () => {
    expect(cloudSaveDownloads(listing, accountId, 'Fortnite').map((file) => file.path)).toEqual(['manifests/save.manifest', 'ChunksV4/00/abc.chunk'])
    expect(cloudSaveDownloads(listing, accountId, 'Sugar')).toEqual([])
    expect(cloudSaveDownloads({ files: { [`${accountId}/G/x`]: { readLink: 'http://plain/x' } } }, accountId, 'G')).toEqual([])
  })

  it('refuses paths that could leave the chosen folder or that Windows cannot name', () => {
    expect(safeSaveSegments('manifests/save.manifest')).toEqual(['manifests', 'save.manifest'])
    expect(safeSaveSegments('a\\b.sav')).toEqual(['a', 'b.sav'])
    for (const unsafe of ['../x', 'a/../../x', '/etc/passwd', '\\\\server\\share', 'C:\\x', 'c:x', 'a//b', './x', 'a/con', 'a/NUL.txt', 'a/b.', 'a/b ', 'a/b?c', 'a\u0000b', '']) {
      expect(safeSaveSegments(unsafe)).toBeNull()
    }
  })

  it('logs listings without the signatures on their links', () => {
    const sample = cloudSaveLogSample(listing)

    expect(sample).not.toContain('Signature')
    expect(sample).toContain('https://storage.example.com/a?…')
    expect(JSON.parse(sample)).toMatchObject({ files: 4 })
  })

  it('formats sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB')
  })
})
