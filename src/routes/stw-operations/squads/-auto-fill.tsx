import type { DecoratedSurvivor, SquadView } from './-hooks'
import type { FillPlan } from './-squad-model'

import { Check } from 'lucide-react'

import { badgeUrl } from '../../../components/items/artboard'
import { EmptyState } from '../../../components/page'
import { Button } from '../../../components/ui/button'
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'

import { formatGain, setBonusOrder, setTotals, SquadEmblem } from './-squad-parts'

import { squadLabelsById } from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

function setMembers(slots: Iterable<[number, DecoratedSurvivor | null | undefined]>) {
  return [...slots].map(([slotIndex, survivor]) => ({
    slotIndex,
    setBonus: survivor?.setBonus ?? null,
  }))
}

/**
 * An auto-fill laid out for approval: each squad it changes, what that squad
 * gains, how many survivors move, and any set bonus that grows or shrinks
 * because of it. Nothing moves until it is applied.
 */
export function AutoFillReview({
  isAssigning,
  onApply,
  onCancel,
  plan,
  squadIds,
  squads,
}: {
  isAssigning: boolean
  onApply: () => void
  onCancel: () => void
  plan: FillPlan<DecoratedSurvivor>
  squadIds: Array<string>
  squads: Array<SquadView>
}) {
  const changed = plan.changes.filter((change) => change.moved > 0)
  const gain = changed.reduce((sum, change) => sum + change.after - change.before, 0)
  const title =
    squadIds.length === 1
      ? `Auto-fill ${squadLabelsById[squadIds[0]] ?? 'squad'}`
      : 'Auto-fill all squads'

  const after = new Map(plan.changes.map((change) => [change.squadId, change.slots]))
  const setsBefore = setTotals(
    squads.map((squad) =>
      setMembers(squad.slots.map((slot) => [slot.slotIndex, slot.survivor]))
    )
  )
  const setsAfter = setTotals(
    squads.map((squad) => {
      const slots = after.get(squad.id)

      return slots
        ? setMembers(slots.entries())
        : setMembers(squad.slots.map((slot) => [slot.slotIndex, slot.survivor]))
    })
  )
  const setChanges = setBonusOrder.filter(
    ({ label }) => (setsBefore.get(label) ?? 0) !== (setsAfter.get(label) ?? 0)
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Leads already in their own squad stay. Everyone else goes where they add the most.
        </DialogDescription>
      </DialogHeader>

      {plan.moved === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-6"
          description="Nothing to move: no survivor would add more anywhere else."
          icon={Check}
          title="Already at their best"
        />
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border/30">
            {changed.map((change) => (
              <li className="flex items-center gap-3 py-2" key={change.squadId}>
                <SquadEmblem className="size-7" squadId={change.squadId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium">
                    {squadLabelsById[change.squadId]}
                  </span>
                  <span className="block text-2xs text-muted-foreground">
                    <span className="figure">{change.moved}</span>{' '}
                    {change.moved === 1 ? 'survivor moves in' : 'survivors move in'}
                  </span>
                </span>
                <span className="figure text-xs text-muted-foreground">
                  {Math.round(change.before).toLocaleString()} →{' '}
                  {Math.round(change.after).toLocaleString()}
                </span>
                <span
                  className={cn(
                    'figure w-14 text-right text-sm font-bold',
                    change.after - change.before > 0.5 ? 'text-success' : 'text-muted-foreground'
                  )}
                >
                  {formatGain(change.after - change.before)}
                </span>
              </li>
            ))}
          </ul>

          {setChanges.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-muted/40 px-3 py-2">
              {setChanges.map(({ file, label }) => {
                const before = setsBefore.get(label) ?? 0
                const now = setsAfter.get(label) ?? 0
                const src = badgeUrl(file)

                return (
                  <li className="flex items-center gap-2.5 text-ui" key={label}>
                    {src && <img alt="" className="size-4 object-contain" src={src} />}
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <span className={cn('figure font-semibold', now < before ? 'text-warning' : 'text-success')}>
                      +{before}% → +{now}%
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <DialogFooter className="items-center gap-2 sm:space-x-0">
        {plan.moved > 0 && (
          <span className="mr-auto text-xs text-muted-foreground">
            F.O.R.T.{' '}
            <span className={cn('figure font-semibold', gain > 0.5 ? 'text-success' : 'text-muted-foreground')}>
              {formatGain(gain)}
            </span>
          </span>
        )}
        <Button disabled={isAssigning} onClick={onCancel} variant="outline">
          {plan.moved > 0 ? 'Cancel' : 'Close'}
        </Button>
        {plan.moved > 0 && (
          <Button disabled={isAssigning} onClick={onApply}>
            {isAssigning ? 'Moving…' : `Move ${plan.moved} ${plan.moved === 1 ? 'survivor' : 'survivors'}`}
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
