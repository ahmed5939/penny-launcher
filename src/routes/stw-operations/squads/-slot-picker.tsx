import type { DecoratedSurvivor, PendingSlot, SquadSlotView, SquadView } from './-hooks'
import type { Candidate } from './-squad-model'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { Users } from 'lucide-react'
import { useState } from 'react'

import { Chip, EmptyState, Pager, paginate, SearchField, Segmented } from '../../../components/page'
import { Button } from '../../../components/ui/button'
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'

import { formatGain, SurvivorArt, SurvivorTraits } from './-squad-parts'
import { leadJobMatches } from './-squad-model'

import {
  squadLabelsById,
  squadLeaderSlotIndex,
} from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

type Scope = 'best' | 'fit'

const pageSize = 40

function matchesQuery(survivor: DecoratedSurvivor, query: string) {
  if (!query) return true

  return [survivor.name, survivor.personality, survivor.setBonus, survivor.managerSynergy]
    .filter(Boolean)
    .some((value) => (value as string).toLowerCase().includes(query))
}

/**
 * Who can take one slot, ranked by what the squad gains. "Matches lead"
 * (or "Right job" for a lead) narrows it to the picks the squad's own
 * bonus favours; the ranking already weighs that in.
 */
export function SlotPicker({
  candidates,
  isAssigning,
  occupant,
  onAssign,
  onClear,
  pendingSlot,
  records,
  squad,
}: {
  candidates: Array<Candidate<DecoratedSurvivor>>
  isAssigning: boolean
  occupant: SquadSlotView | null
  onAssign: (characterId: string) => void
  onClear: () => void
  pendingSlot: PendingSlot
  records: ItemRecordMap
  squad: SquadView
}) {
  const wantsLead = pendingSlot.slotIndex === squadLeaderSlotIndex
  const leadPersonality = squad.lead?.personality ?? null
  const canFilter = wantsLead || Boolean(leadPersonality)

  const [scope, setScope] = useState<Scope>('best')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const fits = (candidate: Candidate<DecoratedSurvivor>) =>
    wantsLead
      ? leadJobMatches(candidate.survivor, squad.id)
      : candidate.survivor.personality === leadPersonality
  const fitCount = candidates.filter(fits).length
  const needle = query.trim().toLowerCase()
  const shown = candidates.filter(
    (candidate) =>
      (scope === 'best' || fits(candidate)) && matchesQuery(candidate.survivor, needle)
  )
  const paged = paginate(shown, page, pageSize)
  const current = occupant?.survivor ?? null
  const bestGain = candidates[0]?.gain ?? 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {wantsLead
            ? `${squad.label} lead`
            : `${squad.label} · slot ${pendingSlot.slotIndex}`}
        </DialogTitle>
        <DialogDescription>
          {current && occupant?.score
            ? `Now ${current.name}, adding ${Math.round(occupant.score.total)}. ${
                bestGain > 0.5 ? 'Best moves first.' : 'Nobody beats that.'
              }`
            : 'Best moves first: the number is what F.O.R.T. gains.'}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        {canFilter && (
          <Segmented
            onChange={(value) => {
              setScope(value)
              setPage(0)
            }}
            options={[
              { label: 'Best', value: 'best' },
              {
                label: `${wantsLead ? 'Right job' : `${leadPersonality}`} · ${fitCount}`,
                value: 'fit',
              },
            ]}
            value={scope}
          />
        )}
        <SearchField
          label="Search survivors"
          onChange={(value) => {
            setQuery(value)
            setPage(0)
          }}
          placeholder="Name, personality or set"
          value={query}
        />
        {current && (
          <Button disabled={isAssigning} onClick={onClear} variant="outline">
            Remove
          </Button>
        )}
      </div>

      {shown.length > 0 ? (
        <ul className={cn('-mx-2', isAssigning && 'pointer-events-none opacity-60')}>
          {paged.items.map((candidate) => (
            <CandidateRow
              candidate={candidate}
              key={candidate.survivor.itemId}
              onAssign={onAssign}
              records={records}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          className="border-0 bg-transparent py-8"
          description={
            needle || scope === 'fit'
              ? 'Nobody matches. Try Best or clear the search.'
              : 'This account has no survivor that fits the slot.'
          }
          icon={Users}
          title="Nobody available"
        />
      )}

      <Pager onPageChange={setPage} page={paged.page} pageSize={pageSize} total={shown.length} />
    </>
  )
}

function CandidateRow({
  candidate,
  onAssign,
  records,
}: {
  candidate: Candidate<DecoratedSurvivor>
  onAssign: (characterId: string) => void
  records: ItemRecordMap
}) {
  const { cost, gain, score, survivor } = candidate
  const elsewhere = survivor.squadId ? (squadLabelsById[survivor.squadId] ?? 'another squad') : null

  return (
    <li>
      <button
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/30"
        onClick={() => onAssign(survivor.itemId)}
        title={
          elsewhere
            ? `Moves ${survivor.name} out of ${elsewhere}, which loses ${Math.round(cost)}`
            : undefined
        }
        type="button"
      >
        <SurvivorArt
          className="size-10"
          personality={survivor.personality}
          portrait={survivor.portrait}
          records={records}
          templateId={survivor.templateId}
        />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-ui font-medium" title={survivor.name}>
              {survivor.name}
            </span>
            {elsewhere && (
              <Chip>
                In {elsewhere}
                {cost > 0.5 && <span className="figure"> · −{Math.round(cost)}</span>}
              </Chip>
            )}
          </span>
          <span className="mt-0.5 block">
            <SurvivorTraits survivor={survivor} />
          </span>
        </span>
        <span className="w-16 shrink-0 text-right">
          <span
            className={cn(
              'figure block text-sm font-bold',
              gain > 0.5 ? 'text-success' : gain < -0.5 ? 'text-warning' : 'text-muted-foreground'
            )}
          >
            {formatGain(gain)}
          </span>
          <span className="block text-2xs text-muted-foreground">
            adds <span className="figure">{Math.round(score.total)}</span>
          </span>
        </span>
      </button>
    </li>
  )
}
