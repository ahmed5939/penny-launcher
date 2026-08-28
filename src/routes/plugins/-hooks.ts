import type {
  MarketplacePlugin,
  MarketplaceSettings,
  MarketplaceSnapshot,
  PluginSummary,
} from '../../types/plugins'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { defaultMarketplaceCatalogUrl } from '../../config/constants/marketplace'

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'IPC request failed.'
}

function matchesQuery(
  plugin: {
    author?: string | null
    category?: string | null
    description: string | null
    id: string
    name: string
  },
  query: string
) {
  const needle = query.trim().toLowerCase()

  if (!needle) return true

  return [plugin.id, plugin.name, plugin.description, plugin.author, plugin.category]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(needle))
}

export function usePluginsData() {
  const [installed, setInstalled] = useState<Array<PluginSummary> | null>(null)
  const [snapshot, setSnapshot] = useState<MarketplaceSnapshot | null>(null)
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null)
  const [catalogUrlDraft, setCatalogUrlDraft] = useState(defaultMarketplaceCatalogUrl)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [readme, setReadme] = useState<{ name: string; content: string } | null>(null)
  const [uninstallTarget, setUninstallTarget] = useState<PluginSummary | null>(null)

  const applySnapshot = useCallback((next: MarketplaceSnapshot) => {
    setSnapshot(next)
    setSettings({
      allowUnsignedRemote: next.allowUnsignedRemote,
      catalogUrl: next.catalogUrl,
    })
    setCatalogUrlDraft(next.catalogUrl)
  }, [])

  const refresh = useCallback((force = false) => {
    const catalog = force
      ? window.electronAPI.refreshMarketplaceCatalog()
      : window.electronAPI.listMarketplacePlugins()

    return Promise.all([window.electronAPI.listPlugins(), catalog])
      .then(([installedPlugins, marketplace]) => {
        const updates = new Set(
          marketplace.plugins
            .filter((plugin) => plugin.updateAvailable)
            .map((plugin) => plugin.id)
        )

        setInstalled(
          installedPlugins.map((plugin) => ({
            ...plugin,
            updateAvailable: plugin.updateAvailable || updates.has(plugin.id),
          }))
        )
        applySnapshot(marketplace)
      })
      .catch((error) => {
        setInstalled((current) => current ?? [])
        setSnapshot((current) => current ?? {
          allowUnsignedRemote: false,
          catalogStatus: 'bundled',
          catalogUrl: defaultMarketplaceCatalogUrl,
          fetchedAt: null,
          plugins: [],
          warning: errorMessage(error),
        })
        toast(`Add-ons could not be loaded: ${errorMessage(error)}`)
      })
  }, [applySnapshot])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runAction = useCallback((
    plugin: { id: string; name: string },
    action: string,
    work: () => Promise< { ok: boolean; error?: string } >,
    success: string,
  ) => {
    setPendingId(plugin.id)
    setPendingAction(action)
    work()
      .then((result) => {
        if (!result.ok) {
          toast(result.error ?? `${plugin.name} could not be updated.`)
          return
        }
        toast(success)
        return refresh()
      })
      .catch((error) =>
        toast(`${plugin.name} failed: ${errorMessage(error)}`)
      )
      .finally(() => {
        setPendingId(null)
        setPendingAction(null)
      })
  }, [refresh])

  const handleInstall = useCallback((plugin: MarketplacePlugin) => {
    runAction(
      plugin,
      'install',
      () => window.electronAPI.installPlugin(plugin.id),
      `${plugin.name} installed.`,
    )
  }, [runAction])

  const handleUpdate = useCallback((plugin: { id: string; name: string }) => {
    runAction(
      plugin,
      'update',
      () => window.electronAPI.updatePlugin(plugin.id),
      `${plugin.name} updated.`,
    )
  }, [runAction])

  const handleUninstall = useCallback((plugin: PluginSummary) => {
    setUninstallTarget(null)
    runAction(
      plugin,
      'uninstall',
      () => window.electronAPI.uninstallPlugin(plugin.id),
      `${plugin.name} uninstalled.`,
    )
  }, [runAction])

  const handleEnabled = useCallback((plugin: PluginSummary, enabled: boolean) => {
    runAction(
      plugin,
      'enable',
      () => window.electronAPI.setPluginEnabled(plugin.id, enabled),
      enabled ? `${plugin.name} enabled.` : `${plugin.name} disabled.`,
    )
  }, [runAction])

  const handleOpen = useCallback((plugin: PluginSummary) => {
    setPendingId(plugin.id)
    setPendingAction('open')
    window.electronAPI
      .openPlugin(plugin.id)
      .then((result) => {
        if (!result.ok) {
          toast(result.error ?? `${plugin.name} could not be opened.`)
        }
      })
      .catch((error) => {
        toast(`${plugin.name} could not be opened: ${errorMessage(error)}`)
      })
      .finally(() => {
        setPendingId(null)
        setPendingAction(null)
      })
  }, [])

  const handleReadme = useCallback((plugin: { id: string; name: string }) => {
    window.electronAPI.readPluginReadme(plugin.id)
      .then((result) => {
        if (!result.ok || !result.content) {
          toast(result.error ?? 'README not found.')
          return
        }
        setReadme({ name: plugin.name, content: result.content })
      })
      .catch((error) =>
        toast(`README could not be opened: ${errorMessage(error)}`)
      )
  }, [])

  const handleSaveSettings = useCallback(() => {
    setPendingAction('settings')
    window.electronAPI
      .updateMarketplaceSettings({
        allowUnsignedRemote: settings?.allowUnsignedRemote ?? false,
        catalogUrl: catalogUrlDraft.trim() || defaultMarketplaceCatalogUrl,
      })
      .then((result) => {
        if (!result.ok || !result.settings) {
          toast(result.error ?? 'Catalog settings could not be saved.')
          return
        }
        setSettings(result.settings)
        setCatalogUrlDraft(result.settings.catalogUrl)
        toast('Catalog settings saved.')
        return refresh(true)
      })
      .catch((error) =>
        toast(`Catalog settings could not be saved: ${errorMessage(error)}`)
      )
      .finally(() => setPendingAction(null))
  }, [catalogUrlDraft, refresh, settings?.allowUnsignedRemote])

  const marketplace = useMemo(
    () => (snapshot?.plugins ?? []).filter((plugin) => matchesQuery(plugin, query)),
    [query, snapshot?.plugins],
  )
  const installedFiltered = useMemo(
    () => (installed ?? []).filter((plugin) => matchesQuery(plugin, query)),
    [installed, query],
  )

  return {
    catalogUrlDraft,
    handleEnabled,
    handleInstall,
    handleOpen,
    handleReadme,
    handleSaveSettings,
    handleUninstall,
    handleUpdate,
    installed: installedFiltered,
    isLoading: installed === null || snapshot === null,
    marketplace,
    pendingAction,
    pendingId,
    query,
    readme,
    refresh,
    setCatalogUrlDraft,
    setReadme,
    setSettings,
    setUninstallTarget,
    settings,
    snapshot,
    uninstallTarget,
    setQuery,
  }
}
