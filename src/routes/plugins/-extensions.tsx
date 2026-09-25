import { useEffect, useState } from 'react'
import type { PluginManageRequest, PluginReview, PluginSummary } from '../../types/plugins'
import { Callout, Chip, FieldGroup, FieldRow } from '../../components/page'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'
import { permissionLabels } from './-permissions'

type Manage = (request: PluginManageRequest) => Promise<void>
export function PluginContributions({ plugin, manage, busy }: { plugin: PluginSummary; manage: Manage; busy: boolean }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const signature = JSON.stringify(plugin.ui.settings)
  useEffect(() => {
    let active = true
    setLoaded(false)
    window.electronAPI.pluginSettings(plugin.id).then((result) => {
      if (!active) return
      if (!result.ok) { setError(result.error ?? 'Could not load settings.'); return }
      setValues(result.values ?? {}); setLoaded(true); setError(null)
    }).catch(() => { if (active) setError('Could not load settings. Try reloading the add-on.') })
    return () => { active = false }
  }, [plugin.id, signature])
  return <div className="mt-4 space-y-3">
    {plugin.ui.panels.map((panel) => <section key={panel.id} className="rounded-lg bg-muted/30 p-3">
      <h3 className="section-label">{panel.title}</h3>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{panel.body}</p>
    </section>)}
    {plugin.ui.actions.length > 0 && <div className="flex flex-wrap gap-2">{plugin.ui.actions.map((action) =>
      <Button key={action.id} variant="secondary" disabled={busy || plugin.status !== 'running'} onClick={() => manage({ action: 'run-action', id: plugin.id, actionId: action.id })}>{action.label}</Button>)}</div>}
    {plugin.ui.settings.length > 0 && <form className="rounded-lg bg-muted/30 p-3" onSubmit={(event) => { event.preventDefault(); manage({ action: 'save-settings', id: plugin.id, values }) }}>
      <h3 className="section-label mb-3">Settings</h3>
      {error && <div className="mb-3" role="alert"><Callout tone="danger">{error}</Callout></div>}
      <FieldGroup>
        {plugin.ui.settings.map((field) => <FieldRow className="py-2.5" key={field.id} label={field.label} stacked={field.type !== 'boolean'}>
          {field.type === 'boolean'
            ? <Switch aria-label={field.label} checked={values[field.id] === true} disabled={!loaded || busy} onCheckedChange={(checked) => setValues({ ...values, [field.id]: checked })} />
            : <Input aria-label={field.label} maxLength={2000} value={String(values[field.id] ?? '')} disabled={!loaded || busy} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} />}
        </FieldRow>)}
      </FieldGroup>
      <Button className="mt-3" size="sm" type="submit" disabled={!loaded || busy || plugin.status !== 'running'}>Save settings</Button>
    </form>}
    {plugin.jobs.length > 0 && <section className="space-y-2 rounded-lg bg-muted/30 p-3">
      <h3 className="section-label">Background jobs</h3>
      {plugin.jobs.map((job) => <div key={job.id} className="text-ui">
        <div className="flex items-center justify-between gap-2"><span>{job.label} <span className="text-muted-foreground">· {job.status}</span></span>
          {job.status === 'running' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => manage({ action: 'cancel-job', id: plugin.id, jobId: job.id })}>Cancel</Button>}
        </div>{job.error && <div className="mt-2" role="alert"><Callout tone="danger">{job.error}</Callout></div>}
      </div>)}
    </section>}
    <details className="text-xs">
      <summary className="text-muted-foreground hover:text-foreground">Diagnostics · {plugin.logs.length} recent entries</summary>
      <p className="my-2 text-muted-foreground">Status: {plugin.status} · {plugin.permissions.length} requested package permissions</p>
      <ul className="mb-3 space-y-1">{plugin.permissions.map((permission) => <li key={permission}>{permissionLabels[permission]}</li>)}</ul>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 font-mono">{plugin.logs.map((log) => `${log.time} [${log.level}] ${log.message}`).join('\n') || 'No runtime logs yet.'}</pre>
    </details>
  </div>
}
export function PluginReviewDialog({ review, busy, accept, cancel }: { review: PluginReview | null; busy: boolean; accept: () => void; cancel: () => void }) {
  return <Dialog open={review !== null} onOpenChange={(open) => { if (!open && !busy) cancel() }}>
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-auto">
      <DialogHeader>
        <DialogTitle>{review?.installed ? 'Review add-on update' : 'Review add-on installation'}</DialogTitle>
        <DialogDescription>{review?.manifest.name} · Version {review?.manifest.version ?? 'unspecified'}. Runs in an isolated sandbox. Approve only access you want this add-on to have.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        {review?.installed && <p>Current version: {review.previousVersion ?? 'unspecified'} → Proposed: {review.manifest.version ?? 'unspecified'}</p>}
        {review?.manifest.repository && <Button variant="outline" onClick={() => window.electronAPI.openExternalURL(review.manifest.repository!)}>View source</Button>}
        <p className="section-label">Requested access</p>
        <ul className="space-y-2">{(review?.manifest.permissions ?? []).map((permission) => <li key={permission} className="rounded-lg bg-muted/40 px-3 py-2">
          {permissionLabels[permission]} {review?.installed && review.addedPermissions.includes(permission) && <Chip className="ml-2" tone="warning">New access</Chip>}
        </li>)}</ul>
        {review?.manifest.fortnite && <div className="rounded-lg bg-muted/40 p-3">
          <p>Fortnite profiles: {review.manifest.fortnite.profiles.join(', ') || 'None'}</p>
          <p className="mt-2 break-words">Fortnite commands: {review.manifest.fortnite.operations.join(', ') || 'None'}</p>
          <p className="mt-2 text-muted-foreground">Account changes require a separate, one-time confirmation in Penny.</p>
        </div>}
        {!review?.manifest.permissions?.length && <p className="text-muted-foreground">No launcher permissions requested.</p>}
        {review?.installed && <p>The current code version is kept for rollback. Saved data is shared across versions; rollback does not undo data changes.</p>}
        <details><summary >Package README</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap text-xs">{review?.readme}</pre></details>
        <p className="break-all text-xs text-muted-foreground">Package SHA-256: {review?.digest}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={busy} onClick={cancel}>Cancel</Button>
        <Button disabled={busy} onClick={accept}>{busy ? 'Applying…' : review?.installed ? 'Approve update' : 'Approve and install'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
