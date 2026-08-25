import type { PluginSummary } from '../../types/plugins'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

export function usePluginsData() {
  const [plugins, setPlugins] = useState<Array<PluginSummary> | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const refresh = useCallback(() => {
    window.electronAPI
      .listPlugins()
      .then(setPlugins)
      .catch(() => setPlugins([]))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleOpen = useCallback((plugin: PluginSummary) => {
    setOpeningId(plugin.id)
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
        setOpeningId(null)
      })
  }, [])

  return {
    handleOpen,
    isLoading: plugins === null,
    openingId,
    plugins: plugins ?? [],
  }
}
