import type { MarketplacePlugin, PluginSummary } from '../../types/plugins'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'IPC request failed.'
}

export function usePluginsData() {
  const [installed, setInstalled] = useState<Array<PluginSummary> | null>(null)
  const [marketplace, setMarketplace] = useState<Array<MarketplacePlugin> | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [readme, setReadme] = useState<{ name: string; content: string } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PluginSummary | null>(null)

  const refresh = useCallback(() => {
    Promise.all([
      window.electronAPI.listPlugins(),
      window.electronAPI.listMarketplacePlugins(),
    ])
      .then(([installedPlugins, marketplacePlugins]) => {
        setInstalled(installedPlugins)
        setMarketplace(marketplacePlugins)
      })
      .catch((error) => {
        setInstalled([])
        setMarketplace([])
        toast(`Add-ons could not be loaded: ${errorMessage(error)}`)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleInstall = useCallback((plugin: MarketplacePlugin) => {
    setPendingId(plugin.id)
    window.electronAPI.installPlugin(plugin.id)
      .then((result) => {
        if (!result.ok) {
          toast(result.error ?? `${plugin.name} could not be installed.`)
          return
        }
        toast(`${plugin.name} installed.`)
        refresh()
      })
      .catch((error) =>
        toast(`${plugin.name} could not be installed: ${errorMessage(error)}`)
      )
      .finally(() => setPendingId(null))
  }, [refresh])

  const handleOpen = useCallback((plugin: PluginSummary) => {
    setPendingId(plugin.id)
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
      })
  }, [])

  const handleRemove = useCallback(() => {
    if (!removeTarget) return

    const plugin = removeTarget
    setPendingId(plugin.id)
    window.electronAPI.removePlugin(plugin.id)
      .then((result) => {
        if (!result.ok) {
          toast(result.error ?? `${plugin.name} could not be removed.`)
          return
        }
        toast(`${plugin.name} removed.`)
        setRemoveTarget(null)
        refresh()
      })
      .catch((error) =>
        toast(`${plugin.name} could not be removed: ${errorMessage(error)}`)
      )
      .finally(() => setPendingId(null))
  }, [refresh, removeTarget])

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

  return {
    handleInstall,
    handleOpen,
    handleReadme,
    handleRemove,
    installed: installed ?? [],
    isLoading: installed === null || marketplace === null,
    marketplace: marketplace ?? [],
    pendingId,
    readme,
    removeTarget,
    setReadme,
    setRemoveTarget,
  }
}
