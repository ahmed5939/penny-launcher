import type { AccountData } from '../../../types/accounts'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { LoadoutCopy, LoadoutEntry, LoadoutsPayload } from '../../../kernel/core/loadouts'

import { ArrowRight, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '../../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import { Callout, EmptyState, Picker, Segmented } from '../../../components/page'
import { Textarea } from '../../../components/ui/textarea'

import { useAccountListStore } from '../../../state/accounts/list'
import { getItemRecord, useItemDatabaseStore } from '../../../state/items/database'

import { useGetSelectedAccount } from '../../../hooks/accounts'

import { toast } from '../../../lib/notifications'
import { cn } from '../../../lib/utils'

import { decodeLoadoutCode, encodeLoadoutCode } from './-code'
import { requestLoadouts } from './-requests'

/** A loadout as template ids — what another account can rebuild it from. */
export function toLoadoutCopy(loadout: LoadoutEntry): LoadoutCopy {
  return {
    commander: loadout.commander?.templateId ?? null,
    defenders: loadout.defenders.map((defender) => ({
      templateId: defender.templateId,
      weapon: defender.schematicTemplateId,
    })),
    gadgets: loadout.gadgets,
    support: loadout.team.map((member) => member.templateId),
    teamPerk: loadout.teamPerk,
  }
}

function useItemName(records: ItemRecordMap) {
  return (templateId: string | null | undefined) =>
    templateId ? (getItemRecord(records, templateId)?.name ?? templateId.split(':').pop()) : null
}

/**
 * Pick an account and one of its loadouts, then overwrite it with `copy`.
 * Items travel by template id and the target's own best copy of each goes
 * in; anything the target does not own is left empty and listed afterwards.
 * Overwrites the chosen loadout, so the button asks twice.
 */
function CopyTargetForm({
  copy,
  defaultTargetId,
  onCancel,
  onDone,
  position,
  records,
  targets,
}: {
  copy: LoadoutCopy | null
  defaultTargetId?: string
  onCancel: () => void
  onDone: () => void
  position?: number
  records: ItemRecordMap
  targets: Array<AccountData>
}) {
  const [targetId, setTargetId] = useState<string>('')
  const [slots, setSlots] = useState<LoadoutsPayload | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [slotId, setSlotId] = useState<string>('')
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = useItemName(records)

  useEffect(() => {
    setTargetId((current) =>
      targets.some((account) => account.accountId === current)
        ? current
        : (targets.find((account) => account.accountId === defaultTargetId) ?? targets[0])?.accountId || ''
    )
  }, [targets, defaultTargetId])

  useEffect(() => {
    setSlots(null)
    setSlotsError(null)
    setSlotId('')
    setArmed(false)
    if (!targetId) return

    let live = true
    requestLoadouts(targetId)
      .then((payload) => {
        if (!live) return
        if (payload.errorMessage) throw new Error(payload.errorMessage)
        setSlots(payload)
        setSlotId(
          payload.loadouts.find((entry) => entry.position === position)?.itemId ?? payload.loadouts[0]?.itemId ?? ''
        )
      })
      .catch(() => live && setSlotsError('Could not read that account’s loadouts. Try again.'))

    return () => {
      live = false
    }
  }, [targetId, position])

  const target = targets.find((account) => account.accountId === targetId)
  const slot = slots?.loadouts.find((entry) => entry.itemId === slotId)

  const apply = () => {
    if (!armed) {
      setArmed(true)
      return
    }
    if (!copy || !target || !slot) return

    setBusy(true)
    const listener = window.electronAPI.notificationLoadoutEdit(async (response) => {
      if (response.accountId !== target.accountId || response.kind !== 'copy') return
      listener.removeListener()
      setBusy(false)

      if (response.errorMessage) {
        toast.error(`Epic rejected the copy: ${response.errorMessage}`)
        return
      }

      const missing = [...new Set(response.missing ?? [])].map(name).filter(Boolean)

      if (missing.length > 0) {
        toast.warning(`Copied to ${target.displayName}, loadout ${slot.position}. Not owned there: ${missing.join(', ')}.`)
      } else {
        toast.success(`Copied to ${target.displayName}, loadout ${slot.position}.`)
      }
      onDone()
    })

    window.electronAPI.editLoadout(target, { copy, kind: 'copy', loadoutId: slot.itemId })
  }

  return (
    <>
      {targets.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-6"
          description="Add another account to the launcher to copy loadouts between them."
          icon={Copy}
          title="No other account"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Picker
              label="Account"
              onChange={setTargetId}
              options={targets.map((account) => ({ label: account.displayName, value: account.accountId }))}
              value={targetId}
            />
            <ArrowRight className="size-4 text-muted-foreground" />
            {/*
              A Select item cannot carry an empty value, so the loadout
              picker only appears once there are loadouts to list.
            */}
            {slots && slots.loadouts.length > 0 && slotId ? (
              <Picker
                label="Loadout"
                onChange={(value) => {
                  setSlotId(value)
                  setArmed(false)
                }}
                options={slots.loadouts.map((entry) => ({
                  label: `Loadout ${entry.position}${entry.commander?.templateId ? ` — ${name(entry.commander.templateId)}` : ' — empty'}`,
                  value: entry.itemId,
                }))}
                value={slotId}
              />
            ) : (
              <span className="text-xs text-muted-foreground" role="status">
                {slotsError ? 'Loadouts unavailable' : slots ? 'No loadouts on that account' : 'Loading loadouts…'}
              </span>
            )}
          </div>
          {slotsError && <Callout tone="danger">{slotsError}</Callout>}
          {slot?.active && <Callout tone="info">This is the loadout {target?.displayName} has equipped.</Callout>}
        </div>
      )}

      <DialogFooter>
        <Button disabled={busy} onClick={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button
          className={cn(!armed && 'min-w-40')}
          disabled={busy || !copy || !slot || !target}
          onClick={apply}
          variant={armed ? 'destructive' : 'default'}
        >
          {busy ? 'Copying…' : armed ? `Confirm — replaces loadout ${slot?.position ?? ''}` : 'Copy loadout'}
        </Button>
      </DialogFooter>
    </>
  )
}

function useLiveAccounts() {
  const accounts = useAccountListStore((state) => state.accounts)

  return useMemo(() => Object.values(accounts).filter((account) => account.authStatus !== 'invalid'), [accounts])
}

/**
 * Copy a loadout onto another account in the launcher, or hand it out as a
 * share code someone else pastes into theirs.
 */
export function CopyLoadoutDialog({
  fromAccountId,
  loadout,
  onOpenChange,
  records,
  title,
}: {
  fromAccountId: string | null
  loadout: LoadoutEntry | null
  onOpenChange: (open: boolean) => void
  records: ItemRecordMap
  title: string
}) {
  const accounts = useLiveAccounts()
  const targets = useMemo(
    () => accounts.filter((account) => account.accountId !== fromAccountId),
    [accounts, fromAccountId]
  )
  const copy = useMemo(() => (loadout ? toLoadoutCopy(loadout) : null), [loadout])
  const [mode, setMode] = useState<'account' | 'code'>('account')
  const [code, setCode] = useState('')

  useEffect(() => {
    setCode('')
    if (!copy) return

    let live = true
    encodeLoadoutCode(copy)
      .then((value) => live && setCode(value))
      .catch(() => live && setCode(''))

    return () => {
      live = false
    }
  }, [copy])

  const copyCode = () =>
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success('Loadout code copied'))
      .catch(() => toast.error('Could not reach the clipboard. Select the code and copy it by hand.'))

  return (
    <Dialog onOpenChange={onOpenChange} open={loadout !== null}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copy {title}</DialogTitle>
          <DialogDescription>
            {mode === 'account'
              ? 'Each hero, the team perk, gadgets and defenders go in as the other account’s own best copy. Anything it does not own is left empty.'
              : 'Send this code to anyone. They paste it under Import code on their Loadouts page, and it fills in with their own copies of each item.'}
          </DialogDescription>
        </DialogHeader>

        <Segmented
          className="self-start"
          onChange={setMode}
          options={[
            { label: 'Another account', value: 'account' },
            { label: 'Share code', value: 'code' },
          ]}
          value={mode}
        />

        {mode === 'account' ? (
          <CopyTargetForm
            copy={copy}
            onCancel={() => onOpenChange(false)}
            onDone={() => onOpenChange(false)}
            position={loadout?.position}
            records={records}
            targets={targets}
          />
        ) : (
          <>
            <Textarea
              aria-label="Loadout code"
              className="min-h-24 break-all font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
              placeholder="Making the code…"
              readOnly
              value={code}
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} variant="ghost">
                Close
              </Button>
              <Button disabled={!code} onClick={copyCode}>
                <Copy className="size-4" />
                Copy code
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Paste a share code and write it into one of the launcher's accounts. */
export function ImportLoadoutDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const records = useItemDatabaseStore((state) => state.records)
  const { selected } = useGetSelectedAccount()
  const targets = useLiveAccounts()
  const name = useItemName(records)
  const [text, setText] = useState('')
  const [copy, setCopy] = useState<LoadoutCopy | null>(null)

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  useEffect(() => {
    setCopy(null)
    if (!text.trim()) return

    let live = true
    decodeLoadoutCode(text).then((value) => live && setCopy(value))

    return () => {
      live = false
    }
  }, [text])

  const heroes = copy ? [copy.commander, ...copy.support].filter(Boolean).length : 0
  const defenders = copy ? copy.defenders.filter((defender) => defender.templateId).length : 0

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a loadout code</DialogTitle>
          <DialogDescription>
            Paste a code someone shared. Each item goes in as your own best copy of it; anything you do not own is left
            empty.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          aria-label="Loadout code"
          autoFocus
          className="min-h-24 break-all font-mono text-xs"
          onChange={(event) => setText(event.target.value)}
          placeholder="PENNY-LOADOUT-1:…"
          value={text}
        />

        {text.trim() && !copy && <Callout tone="danger">That is not a loadout code.</Callout>}
        {copy && (
          <Callout tone="info">
            {copy.commander ? `${name(copy.commander)} commanding, ` : 'No commander, '}
            {heroes} {heroes === 1 ? 'hero' : 'heroes'}, {defenders} {defenders === 1 ? 'defender' : 'defenders'}
            {copy.teamPerk ? `, ${name(copy.teamPerk)}` : ''}.
          </Callout>
        )}

        <CopyTargetForm
          copy={copy}
          defaultTargetId={selected?.accountId}
          onCancel={() => onOpenChange(false)}
          onDone={() => onOpenChange(false)}
          records={records}
          targets={targets}
        />
      </DialogContent>
    </Dialog>
  )
}
