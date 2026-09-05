import type { MarketplacePlugin, PluginManageRequest, PluginReview, PluginSummary } from '../../types/plugins'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Request failed.'
export function usePluginsData() {
  const [installed, setInstalled] = useState<PluginSummary[] | null>(null)
  const [marketplace, setMarketplace] = useState<MarketplacePlugin[] | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [readme, setReadme] = useState<{ name: string; content: string } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PluginSummary | null>(null)
  const [review, setReview] = useState<PluginReview | null>(null)
  const [mode, setMode] = useState({ safeMode: false, forced: false })
  const refresh = useCallback(async () => {
    try {
      const [plugins, catalog, state] = await Promise.all([
        window.electronAPI.listPlugins(), window.electronAPI.listMarketplacePlugins(), window.electronAPI.pluginMode(),
      ])
      setInstalled(plugins); setMarketplace(catalog); setMode(state)
    } catch (error) {
      setInstalled((previous) => previous ?? [])
      setMarketplace((previous) => previous ?? [])
      toast(`Add-ons could not be loaded: ${errorMessage(error)}`)
    }
  }, [])
  useEffect(() => {
    refresh()
    let active = true
    let polling = false
    const timer = setInterval(async () => {
      if (polling) return
      polling = true
      try {
        const plugins = await window.electronAPI.listPlugins()
        if (active) setInstalled(plugins)
      } catch { /* Explicit actions report errors; polling remains quiet. */ }
      finally { polling = false }
    }, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [refresh])
  const perform = useCallback(async (id: string, operation: () => Promise<{ ok: boolean; error?: string }>) => {
    setPendingId(id)
    try { const result = await operation(); if (!result.ok) toast(result.error ?? 'Add-on operation failed.') }
    catch (error) { toast(errorMessage(error)) }
    finally { setPendingId(null); await refresh() }
  }, [refresh])
  const handleReview = useCallback(async (kind: 'catalog' | 'installed' | 'import', id?: string) => {
    setPendingId(id ?? 'import')
    try {
      const result = await window.electronAPI.reviewPlugin(kind, id)
      if (!result.ok) toast(result.error ?? 'Could not inspect add-on.')
      else if (result.review) setReview(result.review)
    } catch (error) { toast(errorMessage(error)) }
    finally { setPendingId(null) }
  }, [])
  const handleInstall = (plugin: MarketplacePlugin) => handleReview('catalog', plugin.id)
  const handleAccept = async () => {
    if (!review) return
    await perform(review.manifest.id, () => window.electronAPI.acceptPluginReview(review.token))
    setReview(null)
  }
  const handleCancelReview = async () => {
    if (!review) return
    const token = review.token
    setReview(null)
    try { await window.electronAPI.discardPluginReview(token) } catch { /* Snapshot expires automatically. */ }
  }
  const handleManage = (request: PluginManageRequest) => perform('id' in request ? request.id : 'safe-mode', () => window.electronAPI.managePlugin(request))
  const handleOpen = (plugin: PluginSummary) => perform(plugin.id, () => window.electronAPI.openPlugin(plugin.id))
  const handleRemove = async () => {
    if (!removeTarget) return
    await perform(removeTarget.id, async () => {
      const result = await window.electronAPI.removePlugin(removeTarget.id)
      if (result.ok) setRemoveTarget(null)
      return result
    })
  }
  const handleReadme = async (plugin: { id: string; name: string }) => {
    try {
      const result = await window.electronAPI.readPluginReadme(plugin.id)
      if (!result.ok) toast(result.error ?? 'README not found.')
      else setReadme({ name: plugin.name, content: result.content ?? '' })
    } catch (error) { toast(errorMessage(error)) }
  }
  return {
    handleInstall, handleOpen, handleReadme, handleRemove, handleReview, handleAccept, handleCancelReview, handleManage,
    installed: installed ?? [], marketplace: marketplace ?? [], isLoading: installed === null || marketplace === null,
    pendingId, readme, removeTarget, setReadme, setRemoveTarget, review, mode,
  }
}
