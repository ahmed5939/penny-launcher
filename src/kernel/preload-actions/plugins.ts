import type {
  MarketplacePlugin,
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

export function listMarketplacePlugins(): Promise<Array<MarketplacePlugin>> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginsMarketplaceList)
}

export function installPlugin(pluginId: string): Promise<PluginActionResult> {
  return ipcRenderer.invoke(ElectronAPIEventKeys.PluginInstall, pluginId)
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

/**
 * Reports the renderer's account scope to the main process so add-ons can
 * ask who the app is currently about (context.accounts.getScoped()).
 */
export function syncAccountScopeForPlugins(scope: {
  primary: string | null
  members: Array<string>
}) {
  ipcRenderer.send(ElectronAPIEventKeys.PluginAccountScopeSync, scope)
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
