import type { MarketplacePlugin, PluginSummary } from '../../types/plugins'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export function usePluginsData() {
  const [installed, setInstalled] = useState<Array<PluginSummary> | null>(null)
  const [marketplace, setMarketplace] = useState<Array<MarketplacePlugin> | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [readme, setReadme] = useState<{ name: string; content: string } | null>(null)

  const refresh = useCallback(() => {
    Promise.all([
      window.electronAPI.listPlugins(),
      window.electronAPI.listMarketplacePlugins(),
    ])
      .then(([installedPlugins, marketplacePlugins]) => {
        setInstalled(installedPlugins)
        setMarketplace(marketplacePlugins)
      })
      .catch(() => {
        setInstalled([])
        setMarketplace([])
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
      .catch(() => toast(`${plugin.name} could not be installed.`))
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
      .catch(() => {
        toast(`${plugin.name} could not be opened.`)
      })
      .finally(() => {
        setPendingId(null)
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
      .catch(() => toast('README could not be opened.'))
  }, [])

  return {
    handleInstall,
    handleOpen,
    handleReadme,
    installed: installed ?? [],
    isLoading: installed === null || marketplace === null,
    marketplace: marketplace ?? [],
    pendingId,
    readme,
    setReadme,
  }
}
