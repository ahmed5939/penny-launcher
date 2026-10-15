import type { SquadIssues, SquadSlotView, SquadView } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { Crown, Plus, Wand2, X } from 'lucide-react'

import { badgeUrl } from '../../../components/items/artboard'
import { Chip, Panel } from '../../../components/page'
import { Button } from '../../../components/ui/button'

import { mythicLeadKey, mythicLeads } from './-lineups'
import {
  SetPips,
  SquadEmblem,
  SurvivorArt,
  SurvivorTraits,
  tallySets,
} from './-squad-parts'

import { prettifyWorkerTrait } from '../../../config/constants/fortnite/items'
import {
  squadLabelsById,
  squadLeadJobs,
  squadLeaderSlotIndex,
} from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

const mythicShort = new Map(mythicLeads.map((lead) => [lead.key, lead.short]))

/** "Birdie" for a Mythic lead, the row name for anyone else. */
function leadShortName(lead: SquadView['lead']) {
  if (!lead) return null

  const key = mythicLeadKey(lead.templateId)

  return (key && mythicShort.get(key)) ?? lead.name
}

/** What needs fixing in a squad, worst first. */
function issueLabels(issues: SquadIssues, hasLead: boolean) {
  const labels: Array<string> = []
  const emptySupports = issues.empty - (hasLead ? 0 : 1)

  if (!hasLead) labels.push('No lead')
  if (issues.wrongJob) labels.push('Wrong lead')
  if (emptySupports > 0) labels.push(`${emptySupports} empty`)
  if (issues.mismatched > 0) labels.push(`${issues.mismatched} mismatched`)

  return labels
}

/** "Doctor" → "EMT Squad": where a lead of that job would count double. */
function homeSquadFor(job: string | null) {
  const wanted = `Is${job?.split('.').pop()?.replace(/^Is/, '').replace(/\s+/g, '') ?? ''}`
  const squadId = Object.entries(squadLeadJobs).find(([, value]) => value === wanted)?.[0]

  return squadId ? squadLabelsById[squadId] : null
}

/**
 * One squad, the way the game lays it out: the lead, then the seven
 * supports, each saying what it adds to the squad's stat and why. The
 * header says what the squad adds and what is wrong with it, so all eight
 * can sit on the page at once and the one to fix still stands out.
 */
export function SquadCard({
  isAssigning,
  onAutoFill,
  onClear,
  onPick,
  records,
  squad,
}: {
  isAssigning: boolean
  onAutoFill: () => void
  onClear: (slotIndex: number) => void
  onPick: (slotIndex: number) => void
  records: ItemRecordMap
  squad: SquadView
}) {
  const issues = issueLabels(squad.issues, Boolean(squad.lead))
  const status = issues.length > 0 ? issues.join(' · ') : `Led by ${leadShortName(squad.lead)}`
  const sets = tallySets(
    squad.slots.map((slot) => ({
      slotIndex: slot.slotIndex,
      setBonus: slot.survivor?.setBonus ?? null,
    }))
  )

  return (
    <Panel className="flex flex-col">
      <header className="flex items-center gap-3 border-b border-border/30 px-4 py-3">
        <SquadEmblem className="size-8" squadId={squad.id} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title font-semibold leading-tight" title={squad.label}>
            {squad.label}
          </h3>
          <p
            className={cn(
              'mt-0.5 flex items-center gap-1.5 truncate text-2xs',
              issues.length > 0 ? 'text-warning' : 'text-muted-foreground'
            )}
          >
            {issues.length > 0 && (
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
            )}
            <span className="truncate" title={status}>
              {status}
            </span>
          </p>
        </div>
        <span className="figure shrink-0 text-title font-bold">
          +{Math.round(squad.total).toLocaleString()}
        </span>
        <Button
          aria-label={`Auto-fill ${squad.label}`}
          className="shrink-0"
          disabled={isAssigning}
          onClick={onAutoFill}
          size="sm"
          title="Fill this squad with its best survivors"
          variant="outline"
        >
          <Wand2 className="size-3.5" />
          Auto-fill
        </Button>
      </header>

      <ul className="flex-1 divide-y divide-border/20 px-2 py-1">
        {squad.slots.map((slot) => (
          <SlotRow
            isAssigning={isAssigning}
            key={slot.slotIndex}
            onClear={() => onClear(slot.slotIndex)}
            onPick={() => onPick(slot.slotIndex)}
            records={records}
            slot={slot}
            squadLabel={squad.label}
          />
        ))}
      </ul>

      {sets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/30 px-3 py-2">
          {sets.map((entry) => {
            const src = badgeUrl(entry.file)

            return (
              <span
                className="flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1"
                key={entry.label}
                title={`${entry.label}: ${entry.count} survivors, ${entry.need} make a set`}
              >
                {src && <img alt="" className="size-3.5 object-contain" src={src} />}
                <span className="text-2xs font-medium">{entry.label}</span>
                <SetPips count={entry.count} need={entry.need} />
                <span
                  className={cn(
                    'figure text-2xs font-semibold',
                    entry.active > 0 ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {entry.active > 0 ? `+${entry.active * entry.pct}%` : `${entry.count}/${entry.need}`}
                </span>
                {entry.active > 0 && entry.spare > 0 && (
                  <span className="text-2xs text-warning">
                    <span className="figure">{entry.spare}</span> spare
                  </span>
                )}
              </span>
            )
          })}
        </div>
      )}
    </Panel>
  )
}

/** The +8 / −2 / ×2 beside a survivor: the squad rule that applies to it. */
function BonusChip({ slot }: { slot: SquadSlotView }) {
  const { score, survivor } = slot

  if (!survivor || !score) return null

  if (slot.slotIndex === squadLeaderSlotIndex) {
    const home = homeSquadFor(survivor.managerSynergy)

    return slot.matchesJob ? (
      <span title="Leads its own job's squad, so it counts double">
        <Chip tone="success">×2</Chip>
      </span>
    ) : (
      <span
        title={
          home
            ? `A ${prettifyWorkerTrait(survivor.managerSynergy)} only counts double in ${home}`
            : undefined
        }
      >
        <Chip tone="warning">Wrong squad</Chip>
      </span>
    )
  }

  if (score.bonus > 0) {
    return (
      <span title="Personality matches the lead">
        <Chip tone="success">+{Math.round(score.bonus)}</Chip>
      </span>
    )
  }

  if (slot.matchesLead === false) {
    return (
      <span title="Personality does not match the lead">
        <Chip tone="warning">
          {score.bonus < 0 ? `−${Math.abs(Math.round(score.bonus))}` : 'No match'}
        </Chip>
      </span>
    )
  }

  return null
}

function SlotRow({
  isAssigning,
  onClear,
  onPick,
  records,
  slot,
  squadLabel,
}: {
  isAssigning: boolean
  onClear: () => void
  onPick: () => void
  records: ItemRecordMap
  slot: SquadSlotView
  squadLabel: string
}) {
  const isLead = slot.slotIndex === squadLeaderSlotIndex
  const { score, survivor } = slot

  if (!survivor || !score) {
    return (
      <li>
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-muted-foreground transition-colors hover:bg-accent/30 hover:text-primary disabled:pointer-events-none disabled:opacity-60"
          disabled={isAssigning}
          onClick={onPick}
          type="button"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-border/70">
            {isLead ? <Crown className="size-4" /> : <Plus className="size-4" />}
          </span>
          <span className="text-ui font-medium">{isLead ? 'Pick a lead' : 'Pick a survivor'}</span>
        </button>
      </li>
    )
  }

  return (
    <li className="group flex items-center gap-0.5">
      <button
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-accent/30 disabled:pointer-events-none disabled:opacity-60"
        disabled={isAssigning}
        onClick={onPick}
        title={`Swap ${survivor.name}`}
        type="button"
      >
        <SurvivorArt
          className={cn('size-9', isLead && 'ring-2 ring-primary/60')}
          personality={survivor.personality}
          portrait={survivor.portrait}
          records={records}
          templateId={survivor.templateId}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-ui font-medium leading-tight" title={survivor.name}>
              {survivor.name}
            </span>
            {isLead && <Chip tone="accent">Lead</Chip>}
          </span>
          <span className="mt-0.5 block">
            <SurvivorTraits survivor={survivor} />
          </span>
        </span>
        <BonusChip slot={slot} />
        <span className="figure w-10 shrink-0 text-right text-ui font-bold">
          {Math.round(score.total)}
        </span>
      </button>
      <Button
        aria-label={`Remove ${survivor.name} from ${squadLabel}`}
        className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
        disabled={isAssigning}
        onClick={onClear}
        size="icon"
        title="Remove from the squad"
        variant="ghost"
      >
        <X className="size-3.5" />
      </Button>
    </li>
  )
}
