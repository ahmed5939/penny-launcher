import { describe, expect, it } from 'vitest'

import shippedCatalog from '../../plugins/marketplace.json'
import {
  canInstallListing,
  compareVersions,
  isVersionNewer,
  launcherMeetsMinimum,
  listingTrust,
  matchesSearch,
  mergeCatalogs,
  parseMarketplaceCatalog,
  parseOriginRecord,
  shouldExecutePlugin,
  toMarketplacePlugin,
} from './plugin-catalog'
import type { NormalizedListing } from './plugin-catalog'

function listing(
  overrides: Partial<NormalizedListing> & Pick<NormalizedListing, 'id' | 'name'>
): NormalizedListing {
  return {
    author: null,
    bundled: false,
    category: null,
    description: null,
    downloadUrl: null,
    homepage: null,
    minLauncherVersion: null,
    readmeUrl: null,
    repository: null,
    screenshots: [],
    sha256: null,
    signature: null,
    version: null,
    ...overrides,
  }
}

describe('marketplace catalog parsing', () => {
  it('accepts the documented document, a raw array, and relative HTTPS URLs', () => {
    const parsed = parseMarketplaceCatalog(
      {
        schemaVersion: 1,
        generatedAt: '2026-08-28T00:00:00.000Z',
        plugins: [
          {
            id: 'endurance',
            name: 'Endurance Automation',
            version: '1.0.0',
            bundled: true,
            screenshots: ['https://pennydb.net/images/endurance.png'],
          },
          {
            id: 'Bad Id',
            name: 'Ignored',
          },
        ],
      },
      'https://pennydb.net/api/marketplace'
    )

    expect(parsed.plugins).toHaveLength(1)
    expect(parsed.plugins[0]?.id).toBe('endurance')
    expect(parsed.plugins[0]?.screenshots).toEqual([
      'https://pennydb.net/images/endurance.png',
    ])

    const fromArray = parseMarketplaceCatalog(
      [
        {
          id: 'radar',
          name: 'Radar',
          download: {
            url: '/marketplace/radar-1.0.0.tgz',
            sha256: 'a'.repeat(64),
          },
        },
      ],
      'https://pennydb.net/api/marketplace'
    )

    expect(fromArray.plugins[0]?.downloadUrl).toBe(
      'https://pennydb.net/marketplace/radar-1.0.0.tgz'
    )
    expect(fromArray.plugins[0]?.sha256).toBe('a'.repeat(64))
  })

  it('parses the shipped Penny DB sample, including bundled Endurance', () => {
    const parsed = parseMarketplaceCatalog(
      shippedCatalog,
      'https://pennydb.net/api/marketplace'
    )

    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bundled: true,
          id: 'endurance',
          name: 'Endurance Automation',
        }),
      ])
    )
  })

  it('rejects non-HTTPS download URLs and credentials', () => {
    const parsed = parseMarketplaceCatalog(
      [
        {
          id: 'evil',
          name: 'Evil',
          download: 'http://example.com/plugin.tgz',
        },
        {
          id: 'creds',
          name: 'Creds',
          url: 'https://user:pass@pennydb.net/plugin.tgz',
        },
      ],
      'https://pennydb.net/api/marketplace'
    )

    expect(parsed.plugins[0]?.downloadUrl).toBeNull()
    expect(parsed.plugins[1]?.downloadUrl).toBeNull()
  })
})

describe('catalog merge and fallback', () => {
  it('keeps bundled Endurance when the remote catalog is missing or empty', () => {
    const bundled = [
      listing({
        bundled: true,
        id: 'endurance',
        name: 'Endurance Automation',
        version: '1.0.0',
      }),
    ]

    expect(mergeCatalogs(null, bundled)).toEqual(bundled)
    expect(mergeCatalogs([], bundled)[0]?.id).toBe('endurance')
  })

  it('lets remote metadata overlay a bundled plugin without dropping bundled install', () => {
    const merged = mergeCatalogs(
      [
        listing({
          description: 'Updated copy from Penny DB.',
          downloadUrl: 'https://pennydb.net/marketplace/endurance-1.1.0.tgz',
          id: 'endurance',
          name: 'Endurance Automation',
          sha256: 'b'.repeat(64),
          version: '1.1.0',
        }),
      ],
      [
        listing({
          bundled: true,
          description: 'Ships with Penny.',
          id: 'endurance',
          name: 'Endurance Automation',
          version: '1.0.0',
        }),
      ]
    )

    expect(merged).toHaveLength(1)
    expect(merged[0]?.bundled).toBe(true)
    expect(merged[0]?.version).toBe('1.1.0')
    expect(merged[0]?.downloadUrl).toContain('endurance-1.1.0.tgz')
  })
})

describe('trust and install policy', () => {
  const hashed = listing({
    downloadUrl: 'https://pennydb.net/marketplace/radar.tgz',
    id: 'radar',
    name: 'Radar',
    sha256: 'c'.repeat(64),
    version: '2.0.0',
  })
  const unsigned = listing({
    downloadUrl: 'https://pennydb.net/marketplace/sketchy.tgz',
    id: 'sketchy',
    name: 'Sketchy',
    version: '1.0.0',
  })

  it('treats a SHA-256 listing as hashed and allows install', () => {
    expect(listingTrust(hashed)).toBe('hashed')
    expect(
      canInstallListing(hashed, {
        allowUnsignedRemote: false,
        launcherVersion: '1.0.0',
      })
    ).toEqual({ ok: true })
  })

  it('blocks unsigned remote install until the override is on', () => {
    expect(listingTrust(unsigned)).toBe('unsigned')
    expect(
      canInstallListing(unsigned, {
        allowUnsignedRemote: false,
        launcherVersion: '1.0.0',
      }).ok
    ).toBe(false)
    expect(
      canInstallListing(unsigned, {
        allowUnsignedRemote: true,
        launcherVersion: '1.0.0',
      })
    ).toEqual({ ok: true })
  })

  it('still allows bundled Endurance with no download URL', () => {
    const endurance = listing({
      bundled: true,
      id: 'endurance',
      name: 'Endurance Automation',
      version: '1.0.0',
    })

    expect(listingTrust(endurance)).toBe('bundled')
    expect(
      canInstallListing(endurance, {
        allowUnsignedRemote: false,
        launcherVersion: '1.0.0',
      })
    ).toEqual({ ok: true })
  })

  it('refuses listings that need a newer launcher', () => {
    const future = listing({
      bundled: true,
      id: 'next',
      minLauncherVersion: '9.0.0',
      name: 'Next',
    })

    expect(
      canInstallListing(future, {
        allowUnsignedRemote: false,
        launcherVersion: '1.0.0',
      }).ok
    ).toBe(false)
  })
})

describe('loader admission', () => {
  it('does not execute disabled or unsigned remote plugins by default', () => {
    expect(
      shouldExecutePlugin({
        allowUnsignedRemote: false,
        disabled: true,
        origin: 'bundled',
        sha256: null,
        treeHashMatches: null,
      }).status
    ).toBe('disabled')

    expect(
      shouldExecutePlugin({
        allowUnsignedRemote: false,
        disabled: false,
        origin: 'remote',
        sha256: null,
        treeHashMatches: null,
      })
    ).toMatchObject({ execute: false, status: 'error' })

    expect(
      shouldExecutePlugin({
        allowUnsignedRemote: false,
        disabled: false,
        origin: 'remote',
        sha256: 'd'.repeat(64),
        treeHashMatches: false,
      }).execute
    ).toBe(false)

    expect(
      shouldExecutePlugin({
        allowUnsignedRemote: false,
        disabled: false,
        origin: 'bundled',
        sha256: null,
        treeHashMatches: null,
      }).execute
    ).toBe(true)

    expect(
      shouldExecutePlugin({
        allowUnsignedRemote: false,
        disabled: false,
        origin: 'local',
        sha256: null,
        treeHashMatches: null,
      }).execute
    ).toBe(true)
  })

  it('parses origin records and flags updates', () => {
    expect(parseOriginRecord({ origin: 'remote', sha256: 'e'.repeat(64) })?.origin).toBe(
      'remote'
    )
    expect(isVersionNewer('1.1.0', '1.0.0')).toBe(true)
    expect(isVersionNewer('1.0.0', '1.0.0')).toBe(false)
    expect(compareVersions('1.2.0', '1.10.0')).toBeLessThan(0)
    expect(launcherMeetsMinimum('1.0.0', '1.0.0')).toBe(true)
    expect(matchesSearch({ author: 'Penny', category: 'Automation', description: 'SSE', id: 'endurance', name: 'Endurance Automation' }, 'endur')).toBe(true)

    const plugin = toMarketplacePlugin(
      listing({
        bundled: true,
        id: 'endurance',
        name: 'Endurance Automation',
        version: '1.1.0',
      }),
      {
        allowUnsignedRemote: false,
        enabled: true,
        installedVersion: '1.0.0',
        launcherVersion: '1.0.0',
        listingSource: 'bundled',
      }
    )

    expect(plugin.updateAvailable).toBe(true)
    expect(plugin.installed).toBe(true)
  })
})
