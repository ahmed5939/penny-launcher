import type { ReactNode } from 'react'

import {
  Activity,
  BookOpen,
  Boxes,
  Code2,
  Download,
  FolderInput,
  FolderOpen,
  LoaderCircle,
  Puzzle,
  Settings2,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

import type { PluginCapability } from '../../types/plugins'

import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Callout,
  Chip,
  EmptyState,
  PageHeader,
  PageTabPanel,
  PageTabs,
  Panel,
  PanelBody,
  PanelFooter,
  StatusPill,
} from '../../components/page'

import { usePluginsData } from './-hooks'
import { PluginContributions, PluginReviewDialog } from './-extensions'

const capabilityLabels: Record<
  PluginCapability,
  { icon: typeof Activity; label: string }
> = {
  accounts: { icon: Activity, label: 'Reads account info' },
  notifications: { icon: Activity, label: 'Desktop notifications' },
  network: { icon: Activity, label: 'Network access' },
  filesystem: { icon: FolderOpen, label: 'File access' },
  'opens-windows': { icon: Boxes, label: 'Opens windows' },
  background: { icon: Activity, label: 'Runs in background' },
  'changes-app-behavior': {
    icon: Settings2,
    label: 'Changes Penny behavior',
  },
}

function CapabilityPills({
  capabilities,
}: {
  capabilities: Array<PluginCapability>
}) {
  if (capabilities.length === 0) return null

  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Access it asks for">
      {capabilities.map((capability) => {
        const { icon: Icon, label } = capabilityLabels[capability]

        return (
          <li key={capability}>
            <Chip className="inline-flex items-center gap-1" tone="warning">
              <Icon className="size-3" />
              {label}
            </Chip>
          </li>
        )
      })}
    </ul>
  )
}

/** Name, version and who made it — the line every add-on card opens on. */
function PluginTitle({
  meta,
  name,
  status,
  version,
}: {
  meta?: string
  name: string
  status?: ReactNode
  version?: string | null
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 text-title font-semibold leading-tight">
          <span className="truncate">{name}</span>
          {version && (
            <span className="figure shrink-0 text-xs font-normal text-muted-foreground">
              v{version}
            </span>
          )}
        </p>
        {meta && <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p>}
      </div>
      {status}
    </div>
  )
}

type LibraryTab = 'discover' | 'installed'

export function RouteComponent() {
  const {
    handleInstall,
    handleReview, handleAccept, handleCancelReview, handleManage, review, mode,
    handleOpen,
    handleReadme,
    handleRemove,
    installed,
    isLoading,
    marketplace,
    pendingId,
    readme,
    removeTarget,
    setReadme,
    setRemoveTarget,
  } = usePluginsData()

  const [tab, setTab] = useState<LibraryTab>('discover')
  const busy = pendingId !== null

  return (
    <>
      <PageHeader
        icon={Puzzle}
        section="Penny add-ons"
        title="Add-on library"
        description="Optional tools that run in their own sandbox, with only the access you approve."
        status={
          mode.safeMode ? (
            <StatusPill tone="warning">Safe mode</StatusPill>
          ) : undefined
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => window.electronAPI.openPluginsDirectory()}>
              <FolderOpen className="size-4" />
              Open folder
            </Button>
            <Button disabled={busy || review !== null} onClick={() => handleReview('import')}>
              <FolderInput className="size-4" />
              Import folder
            </Button>
          </>
        }
      />

      {mode.safeMode && (
        <Callout title="Add-ons are stopped" tone="warning">
          Installed code and saved data are kept.
          {mode.forced ? ' Restart without --disable-plugins to leave safe mode.' : ''}
          <div className="mt-3">
            <Button
              disabled={busy || mode.forced}
              onClick={() => handleManage({ action: 'safe-mode', enabled: false })}
              size="sm"
              variant="secondary"
            >
              Turn off safe mode
            </Button>
          </div>
        </Callout>
      )}

      <PageTabs
        label="Add-on library"
        onValueChange={setTab}
        tabs={[
          { value: 'discover', label: 'Discover' },
          {
            value: 'installed',
            label: installed.length > 0 ? `Installed (${installed.length})` : 'Installed',
          },
        ]}
        value={tab}
      >
        <PageTabPanel activeValue={tab} value="discover">
          {marketplace.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title={isLoading ? 'Loading add-ons…' : 'Catalog is empty'}
              description="Add-on packages will appear here when they are available."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {marketplace.map((plugin) => (
                <Panel className="flex flex-col" key={plugin.id}>
                  <PanelBody className="flex-1">
                    <PluginTitle
                      meta={
                        [plugin.category, plugin.author && `by ${plugin.author}`]
                          .filter(Boolean)
                          .join(' · ') || 'Community add-on'
                      }
                      name={plugin.name}
                      status={
                        plugin.installed ? (
                          <StatusPill tone="active">Installed</StatusPill>
                        ) : undefined
                      }
                      version={plugin.version}
                    />
                    <p className="mt-3 text-ui leading-relaxed text-muted-foreground">
                      {plugin.description ?? 'No description provided.'}
                    </p>
                    <CapabilityPills capabilities={plugin.capabilities} />
                  </PanelBody>
                  <PanelFooter>
                    <Button
                      disabled={busy || review !== null}
                      onClick={() => handleInstall(plugin)}
                    >
                      {pendingId === plugin.id ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Download className="size-4" />
                      )}
                      {plugin.installed ? 'Review catalog version' : 'Review & install'}
                    </Button>
                    <Button variant="ghost" onClick={() => handleReadme(plugin)}>
                      <BookOpen className="size-4" />
                      README
                    </Button>
                    {plugin.repository && (
                      <Button
                        variant="ghost"
                        onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
                      >
                        <Code2 className="size-4" />
                        Source
                      </Button>
                    )}
                  </PanelFooter>
                </Panel>
              ))}
            </div>
          )}
        </PageTabPanel>

        <PageTabPanel activeValue={tab} value="installed">
          {installed.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={isLoading ? 'Loading installed add-ons…' : 'No add-ons installed'}
              description="Pick one from Discover. It stays separate from Penny and you can inspect it in the add-ons folder."
            />
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              {installed.map((plugin) => (
                <Panel key={plugin.id}>
                  <PanelBody>
                    <PluginTitle
                      name={plugin.name}
                      status={
                        plugin.status === 'error' ? (
                          <StatusPill tone="danger">Error</StatusPill>
                        ) : (
                          <StatusPill
                            pulse={plugin.status === 'running'}
                            tone={plugin.status === 'running' ? 'active' : plugin.status === 'review' ? 'warning' : 'idle'}
                          >
                            {plugin.status === 'running' ? 'Running' : plugin.status === 'review' ? 'Needs review' : 'Disabled'}
                          </StatusPill>
                        )
                      }
                      version={plugin.version}
                    />
                    <p className="mt-3 text-ui leading-relaxed text-muted-foreground">
                      {plugin.description ?? 'No description provided.'}
                    </p>
                    <CapabilityPills capabilities={plugin.capabilities} />
                    {plugin.error && (
                      <Callout className="mt-3" title="Add-on needs attention" tone="warning">
                        {plugin.error}
                      </Callout>
                    )}
                    <PluginContributions plugin={plugin} manage={handleManage} busy={busy} />
                  </PanelBody>
                  <PanelFooter>
                    {plugin.status === 'review' ? (
                      <Button disabled={busy || review !== null} onClick={() => handleReview('installed', plugin.id)}>
                        Review access
                      </Button>
                    ) : (
                      <Button
                        disabled={busy || mode.safeMode}
                        onClick={() => handleManage({ action: plugin.status === 'running' ? 'disable' : 'enable', id: plugin.id })}
                        variant={plugin.status === 'running' ? 'secondary' : 'default'}
                      >
                        {plugin.status === 'running' ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    {plugin.canOpen && (
                      <Button disabled={busy} onClick={() => handleOpen(plugin)} variant="secondary">
                        {pendingId === plugin.id && <LoaderCircle className="size-4 animate-spin" />}
                        Open
                      </Button>
                    )}
                    <Button variant="ghost" disabled={busy || mode.safeMode} onClick={() => handleManage({ action: 'reload', id: plugin.id })}>
                      Reload
                    </Button>
                    {plugin.canRollback && (
                      <Button variant="ghost" disabled={busy} onClick={() => handleManage({ action: 'rollback', id: plugin.id })}>
                        Roll back code
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => handleReadme(plugin)}>
                      <BookOpen className="size-4" />
                      README
                    </Button>
                    {plugin.repository && (
                      <Button
                        variant="ghost"
                        onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
                      >
                        <Code2 className="size-4" />
                        Source
                      </Button>
                    )}
                    <Button
                      aria-label={`Remove ${plugin.name}`}
                      className="ml-auto text-destructive/80 hover:text-destructive"
                      disabled={busy}
                      onClick={() => setRemoveTarget(plugin)}
                      size="icon"
                      title="Remove"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </PanelFooter>
                </Panel>
              ))}
            </div>
          )}
        </PageTabPanel>
      </PageTabs>

      {/* Fine print, and the one control that stops everything at once. */}
      {!mode.safeMode && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Every install and update is reviewed before it runs, and an add-on
          gets only the launcher access it declared.
          <button
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={busy || mode.forced}
            onClick={() => handleManage({ action: 'safe-mode', enabled: true })}
            type="button"
          >
            Stop all with safe mode
          </button>
        </p>
      )}

      <PluginReviewDialog review={review} busy={pendingId !== null} accept={handleAccept} cancel={handleCancelReview} />
      <Dialog open={readme !== null} onOpenChange={(open) => !open && setReadme(null)}>
        <DialogContent className="max-h-[80vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)]">
          <DialogHeader>
            <DialogTitle>{readme?.name} README</DialogTitle>
            <DialogDescription>Documentation shipped with this add-on.</DialogDescription>
          </DialogHeader>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted/60 p-4 font-mono text-xs leading-relaxed">
            {readme?.content}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(open) => !open && pendingId === null && setRemoveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.name}?</DialogTitle>
            <DialogDescription>
              The add-on will stop running and its installed files will be removed. Its saved data will be kept in case you install it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pendingId !== null}
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
            <Button disabled={pendingId !== null} onClick={handleRemove} variant="destructive">
              {pendingId === removeTarget?.id && (
                <LoaderCircle className="size-4 animate-spin" />
              )}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
