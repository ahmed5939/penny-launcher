import { UpdateIcon } from '@radix-ui/react-icons'
import { BookOpen, Boxes, Code2, Download, FolderOpen, Puzzle } from 'lucide-react'

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

export function RouteComponent() {
  const {
    handleInstall,
    handleOpen,
    handleReadme,
    installed,
    isLoading,
    marketplace,
    pendingId,
    readme,
    setReadme,
  } = usePluginsData()

  return (
    <>
      <PageHeader
        icon={Puzzle}
        section="Penny add-ons"
        title="Add-on library"
        description="Optional tools you choose to install. Every add-on includes readable documentation and source code."
        actions={
          <Button variant="outline" onClick={() => window.electronAPI.openPluginsDirectory()}>
            <FolderOpen className="mr-2 size-4" />
            Open add-ons folder
          </Button>
        }
      />

      <Callout className="mb-4" title="Add-ons run with desktop access" tone="warning">
        Review the README and source before installing add-ons you do not trust.
        Installed add-ons can access the same files and services as Penny.
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
                  </PanelBody>
                  <PanelFooter>
                    <Button
                      disabled={plugin.installed || pendingId !== null}
                      onClick={() => handleInstall(plugin)}
                    >
                      {pendingId === plugin.id ? (
                        <UpdateIcon className="mr-2 animate-spin" />
                      ) : (
                        <Download className="mr-2 size-4" />
                      )}
                      {plugin.installed ? 'Installed' : 'Install'}
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
                        <StatusPill tone="active">Ready</StatusPill>
                      )
                    }
                  />
                  <PanelBody>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {plugin.description ?? 'No description provided.'}
                    </p>
                    {plugin.error && (
                      <Callout className="mt-3" title="Add-on failed to load" tone="warning">
                        {plugin.error}
                      </Callout>
                    )}
                  </PanelBody>
                  <PanelFooter>
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
                  </PanelFooter>
                </Panel>
              ))}
            </div>
          )}
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
    </>
  )
}
