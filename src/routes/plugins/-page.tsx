import { UpdateIcon } from '@radix-ui/react-icons'
import {
  Activity,
  BookOpen,
  Boxes,
  Code2,
  Download,
  FolderOpen,
  Puzzle,
  Settings2,
  Trash2,
} from 'lucide-react'

import type { PluginCapability } from '../../types/plugins'

import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
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
    <div className="mt-3 flex flex-wrap gap-2">
      {capabilities.map((capability) => {
        const { icon: Icon, label } = capabilityLabels[capability]

        return (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-wide text-warning"
            key={capability}
          >
            <Icon className="size-3" />
            {label}
          </span>
        )
      })}
    </div>
  )
}

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

  return (
    <>
      <PageHeader
        icon={Puzzle}
        section="Penny add-ons"
        title="Add-on library"
        description="Optional tools with reviewed permissions, isolated execution, and controls you own."
        actions={
          <div className="flex flex-wrap gap-2">
          <Button disabled={pendingId !== null || review !== null} onClick={() => handleReview('import')}>Import folder</Button>
          <Button variant="outline" onClick={() => window.electronAPI.openPluginsDirectory()}>
            <FolderOpen className="mr-2 size-4" />
            Open add-ons folder
          </Button>
          </div>
        }
      />

      <Callout className="mb-4" title={mode.safeMode ? 'Safe mode: add-ons are stopped' : 'Add-ons run in isolated sandboxes'} tone={mode.safeMode ? 'warning' : 'info'}>
        {mode.safeMode ? 'Installed code and saved data are retained. Turn off safe mode to resume enabled add-ons.' : 'Every installation and update is reviewed before execution. Plugins receive only their declared launcher permissions.'}
        {mode.forced && <p>Restart without --disable-plugins to leave safe mode.</p>}
        <Button className="mt-3" variant="outline" disabled={pendingId !== null || mode.forced} onClick={() => handleManage({ action: 'safe-mode', enabled: !mode.safeMode })}>
          {mode.safeMode ? 'Turn off safe mode' : 'Stop all with safe mode'}
        </Button>
      </Callout>

      <Tabs defaultValue="discover">
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="installed">
            Installed{installed.length > 0 ? ` (${installed.length})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          {marketplace.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title={isLoading ? 'Loading add-ons…' : 'Catalog is empty'}
              description="Add-on packages will appear here when they are available."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {marketplace.map((plugin) => (
                <Panel key={plugin.id}>
                  <PanelHeader
                    icon={Boxes}
                    title={
                      <span className="flex items-center gap-2">
                        {plugin.name}
                        {plugin.version && (
                          <span className="text-xs font-normal text-muted-foreground">v{plugin.version}</span>
                        )}
                      </span>
                    }
                    description={
                      [plugin.category, plugin.author && `by ${plugin.author}`]
                        .filter(Boolean)
                        .join(' · ') || 'Community add-on'
                    }
                    actions={plugin.installed ? <StatusPill tone="active">Installed</StatusPill> : undefined}
                  />
                  <PanelBody>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {plugin.description ?? 'No description provided.'}
                    </p>
                    <CapabilityPills capabilities={plugin.capabilities} />
                  </PanelBody>
                  <PanelFooter>
                    <Button
                      disabled={pendingId !== null || review !== null}
                      onClick={() => handleInstall(plugin)}
                    >
                      {pendingId === plugin.id ? (
                        <UpdateIcon className="mr-2 animate-spin" />
                      ) : (
                        <Download className="mr-2 size-4" />
                      )}
                      {plugin.installed ? 'Review catalog version' : 'Review & install'}
                    </Button>
                    <Button variant="outline" onClick={() => handleReadme(plugin)}>
                      <BookOpen className="mr-2 size-4" />
                      README
                    </Button>
                    {plugin.repository && (
                      <Button
                        variant="ghost"
                        onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
                      >
                        <Code2 className="mr-2 size-4" />
                        Source
                      </Button>
                    )}
                  </PanelFooter>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed">
          {installed.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={isLoading ? 'Loading installed add-ons…' : 'No add-ons installed'}
              description="Choose an add-on from Discover. It stays separate from Penny and can be inspected in your add-ons folder."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {installed.map((plugin) => (
                <Panel key={plugin.id}>
                  <PanelHeader
                    icon={Boxes}
                    title={plugin.name}
                    description={plugin.version ? `Version ${plugin.version}` : 'Installed add-on'}
                    actions={
                      plugin.status === 'error' ? (
                        <StatusPill tone="danger">Error</StatusPill>
                      ) : (
                        <StatusPill pulse={plugin.status === 'running'} tone={plugin.status === 'running' ? 'active' : 'warning'}>{plugin.status === 'running' ? 'Running' : plugin.status === 'review' ? 'Needs review' : 'Disabled'}</StatusPill>
                      )
                    }
                  />
                  <PanelBody>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {plugin.description ?? 'No description provided.'}
                    </p>
                    <CapabilityPills capabilities={plugin.capabilities} />
                    <PluginContributions plugin={plugin} manage={handleManage} busy={pendingId !== null} />
                    {plugin.error && (
                      <Callout className="mt-3" title="Add-on needs attention" tone="warning">
                        {plugin.error}
                      </Callout>
                    )}
                  </PanelBody>
                  <PanelFooter>
                    {plugin.status === 'review'
                      ? <Button disabled={pendingId !== null || review !== null} onClick={() => handleReview('installed', plugin.id)}>Review access</Button>
                      : <Button variant="outline" disabled={pendingId !== null || mode.safeMode} onClick={() => handleManage({ action: plugin.status === 'running' ? 'disable' : 'enable', id: plugin.id })}>{plugin.status === 'running' ? 'Disable' : 'Enable'}</Button>}
                    <Button variant="outline" disabled={pendingId !== null || mode.safeMode} onClick={() => handleManage({ action: 'reload', id: plugin.id })}>Reload</Button>
                    {plugin.canRollback && <Button variant="outline" disabled={pendingId !== null} onClick={() => handleManage({ action: 'rollback', id: plugin.id })}>Roll back code</Button>}
                    {plugin.canOpen && (
                      <Button disabled={pendingId !== null} onClick={() => handleOpen(plugin)}>
                        {pendingId === plugin.id && <UpdateIcon className="mr-2 animate-spin" />}
                        Open
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleReadme(plugin)}>
                      <BookOpen className="mr-2 size-4" />
                      README
                    </Button>
                    {plugin.repository && (
                      <Button
                        variant="ghost"
                        onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
                      >
                        <Code2 className="mr-2 size-4" />
                        Source
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={pendingId !== null}
                      onClick={() => setRemoveTarget(plugin)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remove
                    </Button>
                  </PanelFooter>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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
            <Button disabled={pendingId !== null} onClick={handleRemove}>
              {pendingId === removeTarget?.id && (
                <UpdateIcon className="mr-2 animate-spin" />
              )}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
