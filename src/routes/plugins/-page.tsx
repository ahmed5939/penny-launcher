import {
  BookOpen,
  Boxes,
  Code2,
  Download,
  FolderOpen,
  Globe,
  Puzzle,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { UpdateIcon } from '@radix-ui/react-icons'

import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import {
  Callout,
  Chip,
  EmptyState,
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatusPill,
} from '../../components/page'
import type { ReactNode } from 'react'
import type { MarketplacePlugin, PluginSummary, PluginTrust } from '../../types/plugins'

import { usePluginsData } from './-hooks'

function trustChip(trust: PluginTrust, bundled?: boolean) {
  if (bundled || trust === 'bundled') return <Chip>Ships with Penny</Chip>
  if (trust === 'signed') return <Chip tone="success">Signed</Chip>
  if (trust === 'hashed') return <Chip tone="success">Hashed</Chip>
  if (trust === 'local') return <Chip>Local</Chip>
  return <Chip tone="warning">Unsigned</Chip>
}

function catalogStatusLabel(
  status: 'live' | 'cache' | 'bundled' | undefined
) {
  if (status === 'live') return 'Live from Penny DB'
  if (status === 'cache') return 'Cached catalog'
  return 'Bundled catalog'
}

function PluginActions({
  children,
}: {
  children: ReactNode
}) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

function MarketplaceRow({
  onInstall,
  onReadme,
  onUpdate,
  pendingAction,
  pendingId,
  plugin,
}: {
  onInstall: (plugin: MarketplacePlugin) => void
  onReadme: (plugin: MarketplacePlugin) => void
  onUpdate: (plugin: MarketplacePlugin) => void
  pendingAction: string | null
  pendingId: string | null
  plugin: MarketplacePlugin
}) {
  const busy = pendingId === plugin.id
  const installDisabled =
    Boolean(plugin.blockedReason) ||
    (plugin.installed && !plugin.updateAvailable) ||
    pendingId !== null

  return (
    <article className="panel px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{plugin.name}</h3>
            {plugin.version && (
              <span className="text-xs text-muted-foreground">v{plugin.version}</span>
            )}
            {plugin.installed && <StatusPill tone="active">Installed</StatusPill>}
            {plugin.updateAvailable && <Chip tone="accent">Update</Chip>}
            {trustChip(plugin.trust, plugin.bundled)}
            {plugin.listingSource === 'remote' && !plugin.bundled && (
              <Chip tone="accent">Penny DB</Chip>
            )}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {plugin.description ?? 'No description provided.'}
          </p>
          <p className="text-xs text-muted-foreground">
            {[plugin.category, plugin.author && `by ${plugin.author}`]
              .filter(Boolean)
              .join(' · ') || 'Community add-on'}
          </p>
          {plugin.screenshots.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pt-1">
              {plugin.screenshots.map((src) => (
                <img
                  alt=""
                  className="h-16 rounded-md border border-border/60 object-cover"
                  key={src}
                  src={src}
                />
              ))}
            </div>
          )}
          {plugin.blockedReason && !plugin.installed && (
            <p className="text-xs text-warning">{plugin.blockedReason}</p>
          )}
        </div>
        <PluginActions>
          {plugin.updateAvailable ? (
            <Button
              disabled={pendingId !== null}
              onClick={() => onUpdate(plugin)}
              size="sm"
            >
              {busy && pendingAction === 'update' ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Update
            </Button>
          ) : (
            <Button
              disabled={installDisabled}
              onClick={() => onInstall(plugin)}
              size="sm"
            >
              {busy && pendingAction === 'install' ? (
                <UpdateIcon className="animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              {plugin.installed ? 'Installed' : 'Install'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onReadme(plugin)}>
            <BookOpen className="size-3.5" />
            README
          </Button>
          {plugin.repository && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
            >
              <Code2 className="size-3.5" />
              Source
            </Button>
          )}
          {plugin.homepage && plugin.homepage !== plugin.repository && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.electronAPI.openExternalURL(plugin.homepage!)}
            >
              <Globe className="size-3.5" />
              Site
            </Button>
          )}
        </PluginActions>
      </div>
    </article>
  )
}

function InstalledRow({
  onEnabled,
  onOpen,
  onReadme,
  onUninstall,
  onUpdate,
  pendingAction,
  pendingId,
  plugin,
}: {
  onEnabled: (plugin: PluginSummary, enabled: boolean) => void
  onOpen: (plugin: PluginSummary) => void
  onReadme: (plugin: PluginSummary) => void
  onUninstall: (plugin: PluginSummary) => void
  onUpdate: (plugin: PluginSummary) => void
  pendingAction: string | null
  pendingId: string | null
  plugin: PluginSummary
}) {
  const busy = pendingId === plugin.id

  return (
    <article className="panel px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{plugin.name}</h3>
            {plugin.version && (
              <span className="text-xs text-muted-foreground">v{plugin.version}</span>
            )}
            {plugin.status === 'error' ? (
              <StatusPill tone="danger">Error</StatusPill>
            ) : plugin.status === 'disabled' ? (
              <StatusPill tone="idle">Disabled</StatusPill>
            ) : (
              <StatusPill tone="active">Ready</StatusPill>
            )}
            {trustChip(plugin.trust, plugin.origin === 'bundled')}
            {plugin.updateAvailable && <Chip tone="accent">Update</Chip>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {plugin.description ?? 'No description provided.'}
          </p>
          {plugin.error && (
            <Callout className="mt-2" title="Add-on failed to load" tone="warning">
              {plugin.error}
            </Callout>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <label className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            Enabled
            <Switch
              checked={plugin.enabled}
              disabled={pendingId !== null}
              onCheckedChange={(checked) => onEnabled(plugin, checked)}
            />
          </label>
          <PluginActions>
            {plugin.canOpen && plugin.status === 'active' && (
              <Button
                disabled={pendingId !== null}
                onClick={() => onOpen(plugin)}
                size="sm"
              >
                {busy && pendingAction === 'open' && (
                  <UpdateIcon className="animate-spin" />
                )}
                Open
              </Button>
            )}
            {plugin.updateAvailable && (
              <Button
                disabled={pendingId !== null}
                onClick={() => onUpdate(plugin)}
                size="sm"
                variant="outline"
              >
                {busy && pendingAction === 'update' ? (
                  <UpdateIcon className="animate-spin" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Update
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onReadme(plugin)}>
              <BookOpen className="size-3.5" />
              README
            </Button>
            {plugin.repository && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.electronAPI.openExternalURL(plugin.repository!)}
              >
                <Code2 className="size-3.5" />
                Source
              </Button>
            )}
            <Button
              disabled={pendingId !== null}
              onClick={() => onUninstall(plugin)}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="size-3.5" />
              Uninstall
            </Button>
          </PluginActions>
        </div>
      </div>
    </article>
  )
}

export function RouteComponent() {
  const {
    catalogUrlDraft,
    handleEnabled,
    handleInstall,
    handleOpen,
    handleReadme,
    handleSaveSettings,
    handleUninstall,
    handleUpdate,
    installed,
    isLoading,
    marketplace,
    pendingAction,
    pendingId,
    query,
    readme,
    refresh,
    setCatalogUrlDraft,
    setQuery,
    setReadme,
    setSettings,
    setUninstallTarget,
    settings,
    snapshot,
    uninstallTarget,
  } = usePluginsData()

  return (
    <>
      <PageHeader
        icon={Puzzle}
        section="Penny add-ons"
        title="Add-on library"
        description="Browse Penny DB, then install, update, or remove add-ons. Bundled tools stay available if the catalog is down."
        status={
          <StatusPill tone={snapshot?.catalogStatus === 'live' ? 'active' : 'warning'}>
            {catalogStatusLabel(snapshot?.catalogStatus)}
          </StatusPill>
        }
        actions={
          <>
            <Button
              disabled={pendingAction === 'settings'}
              onClick={() => refresh(true)}
              variant="outline"
            >
              <RefreshCw className="size-4" />
              Refresh catalog
            </Button>
            <Button variant="outline" onClick={() => window.electronAPI.openPluginsDirectory()}>
              <FolderOpen className="size-4" />
              Open add-ons folder
            </Button>
          </>
        }
      />

      <Callout className="mb-4" title="Add-ons run with desktop access" tone="warning">
        Review the README and source before installing anything you do not trust.
        Remote packages need a SHA-256 hash unless you allow unsigned ones.
      </Callout>

      {snapshot?.warning && (
        <Callout className="mb-4" title="Catalog fallback" tone="info">
          {snapshot.warning}
        </Callout>
      )}

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search add-ons"
          value={query}
        />
      </div>

      <Tabs defaultValue="discover">
        <TabsList>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="installed">
            Installed{installed.length > 0 ? ` (${installed.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="discover">
          {marketplace.length === 0 ? (
            <EmptyState
              icon={Puzzle}
              title={isLoading ? 'Loading add-ons…' : 'No matching add-ons'}
              description={
                isLoading
                  ? 'Checking Penny DB, then the bundled catalog.'
                  : 'Try another search, or refresh the catalog.'
              }
            />
          ) : (
            <div className="space-y-2">
              {marketplace.map((plugin) => (
                <MarketplaceRow
                  key={plugin.id}
                  onInstall={handleInstall}
                  onReadme={handleReadme}
                  onUpdate={handleUpdate}
                  pendingAction={pendingAction}
                  pendingId={pendingId}
                  plugin={plugin}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="installed">
          {installed.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title={isLoading ? 'Loading installed add-ons…' : 'No add-ons installed'}
              description="Install from Discover. Endurance Automation ships with Penny and stays listed if Penny DB is down."
            />
          ) : (
            <div className="space-y-2">
              {installed.map((plugin) => (
                <InstalledRow
                  key={plugin.id}
                  onEnabled={handleEnabled}
                  onOpen={handleOpen}
                  onReadme={handleReadme}
                  onUninstall={setUninstallTarget}
                  onUpdate={handleUpdate}
                  pendingAction={pendingAction}
                  pendingId={pendingId}
                  plugin={plugin}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog">
          <Panel>
            <PanelHeader
              title="Catalog source"
              description="Penny DB hosts the live list. Change the URL only if you are mirroring the same JSON schema."
            />
            <PanelBody>
              <FieldGroup>
                <FieldRow
                  label="Catalog URL"
                  hint="HTTPS JSON. Default is https://pennydb.net/api/marketplace."
                  stacked
                >
                  <Input
                    onChange={(event) => setCatalogUrlDraft(event.target.value)}
                    spellCheck={false}
                    value={catalogUrlDraft}
                  />
                </FieldRow>
                <FieldRow
                  label="Allow unsigned remote add-ons"
                  hint="Off by default. Bundled and local folders still load. Hashed Penny DB packages still install."
                >
                  <Switch
                    checked={settings?.allowUnsignedRemote === true}
                    onCheckedChange={(checked) =>
                      setSettings((current) => ({
                        allowUnsignedRemote: checked,
                        catalogUrl: current?.catalogUrl ?? catalogUrlDraft,
                      }))
                    }
                  />
                </FieldRow>
              </FieldGroup>
              <div className="mt-4">
                <Button
                  disabled={pendingAction === 'settings'}
                  onClick={handleSaveSettings}
                >
                  {pendingAction === 'settings' && (
                    <UpdateIcon className="animate-spin" />
                  )}
                  Save catalog settings
                </Button>
              </div>
            </PanelBody>
          </Panel>
        </TabsContent>
      </Tabs>

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
        open={uninstallTarget !== null}
        onOpenChange={(open) => !open && setUninstallTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall {uninstallTarget?.name}?</DialogTitle>
            <DialogDescription>
              Removes the add-on folder. Per-add-on settings under plugin-data are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => uninstallTarget && handleUninstall(uninstallTarget)}
            >
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
