import type {
  MarketplaceSettings,
  MarketplaceSnapshot,
  PluginActionResult,
  PluginOpenResult,
  PluginReadmeResult,
  PluginSummary,
} from '../../types/plugins'
import type { IpcRendererEvent } from 'electron'

import { ipcRenderer } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'

export function listPlugins(): Promise<Array<PluginSummary>> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginsList)
}

export function listMarketplacePlugins(): Promise<MarketplaceSnapshot> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginsMarketplaceList)
}

export function refreshMarketplaceCatalog(): Promise<MarketplaceSnapshot> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginMarketplaceRefresh)
}

export function getMarketplaceSettings(): Promise<MarketplaceSettings> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginMarketplaceSettingsGet)
}

export function updateMarketplaceSettings(
  patch: Partial<MarketplaceSettings>,
): Promise<PluginActionResult & { settings?: MarketplaceSettings }> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.PluginMarketplaceSettingsUpdate,
    patch,
  )
}

export function installPlugin(pluginId: string): Promise<PluginActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginInstall, pluginId)
}

export function updatePlugin(pluginId: string): Promise<PluginActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginUpdate, pluginId)
}

export function uninstallPlugin(pluginId: string): Promise<PluginActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginUninstall, pluginId)
}

export function setPluginEnabled(
  pluginId: string,
  enabled: boolean,
): Promise<PluginActionResult> {
  return ipcRenderer.invoke(
    ElectronAPIEventKeys.PluginSetEnabled,
    pluginId,
    enabled,
  )
}

export function readPluginReadme(
  pluginId: string,
): Promise<PluginReadmeResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginReadme, pluginId)
}

export function openPluginsDirectory(): Promise<void> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginsDirectoryOpen)
}

export function openPlugin(pluginId: string): Promise<PluginOpenResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginOpen, pluginId)
}

export function pluginNavigation(
  callback: (route: string) => Promise<void>,
) {
  const listener = (_: IpcRendererEvent, route: string) => {
    callback(route).catch(console.error)
  }

  ipcRenderer.on(ElectronAPIEventKeys.PluginNavigate, listener)

  return {
    removeListener: () =>
      ipcRenderer.removeListener(ElectronAPIEventKeys.PluginNavigate, listener),
  }
}
