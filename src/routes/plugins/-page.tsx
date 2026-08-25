import { UpdateIcon } from '@radix-ui/react-icons'
import { Link } from '@tanstack/react-router'
import { Puzzle } from 'lucide-react'

import { Button } from '../../components/ui/button'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  StatusPill,
} from '../../components/page'

import { usePluginsData } from './-hooks'

export function RouteComponent() {
  const { handleOpen, isLoading, openingId, plugins } = usePluginsData()

  return (
    <>
      <PageHeader
        icon={Puzzle}
        section="Penny"
        title="Plugins"
        description="Add-ons that extend the launcher. Built-in plugins ship with the app; drop extra plugin folders into the data directory to add your own."
      />

      {plugins.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title={isLoading ? 'Loading plugins…' : 'No plugins installed'}
          description="Put a plugin folder (plugin.json + main.js) inside the plugins folder of the launcher's data directory and restart."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plugins.map((plugin) => (
            <Panel
              className="p-4"
              key={plugin.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    {plugin.name}
                    {plugin.version && (
                      <span className="text-xs font-normal text-muted-foreground">
                        v{plugin.version}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {plugin.source === 'native'
                      ? 'Native plugin'
                      : plugin.source === 'built-in'
                        ? 'Built-in plugin'
                        : 'User plugin'}
                  </p>
                </div>
                {plugin.status === 'error' ? (
                  <StatusPill tone="danger">Error</StatusPill>
                ) : (
                  <StatusPill tone="active">Loaded</StatusPill>
                )}
              </div>

              {plugin.description && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {plugin.description}
                </p>
              )}

              {plugin.error && (
                <Callout
                  className="mt-3"
                  title="Plugin failed to load"
                  tone="warning"
                >
                  {plugin.error}
                </Callout>
              )}

              {plugin.route ? (
                <div className="mt-4">
                  <Button
                    asChild
                    className="min-w-28"
                  >
                    <Link to={plugin.route}>Open</Link>
                  </Button>
                </div>
              ) : (
                plugin.canOpen && (
                  <div className="mt-4">
                    <Button
                      className="min-w-28"
                      disabled={openingId !== null}
                      onClick={() => handleOpen(plugin)}
                    >
                      {openingId === plugin.id ? (
                        <UpdateIcon className="animate-spin" />
                      ) : (
                        'Open'
                      )}
                    </Button>
                  </div>
                )
              )}
            </Panel>
          ))}
        </div>
      )}
    </>
  )
}
