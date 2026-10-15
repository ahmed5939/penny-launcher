import type { DecoratedSurvivor, PendingSlot } from './-hooks'
import type { Lineup, LineupSlot, SupportPlan } from './-lineups'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Artboard, BadgeMark, badgeUrl } from '../../../components/items/artboard'
import { resolveItemArt } from '../../../components/items/item-icon'
import { Chip, Panel, PanelBody, PanelHeader, Segmented } from '../../../components/page'
import { Button } from '../../../components/ui/button'

import { mythicLeads, ownedMythicLeadCount, planLineups, planSupports } from './-lineups'
import { squadEmblems } from './-squad-parts'

import {
  squadLabelsById,
  squadLeaderSlotIndex,
} from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

type Scope = 'damage' | 'all'

function lineupKey(lineup: Lineup) {
  return lineup.map((lead) => lead.key).join('|')
}

function personalityMark(personality: string) {
  const src = badgeUrl(`survivors-${personality.toLowerCase()}`)

  return src ? { label: personality, src } : null
}

/**
 * The Mythic lead lineup the account is closest to, one squad per cell, and
 * where Joel and Karolina belong in it. An owned lead that is not leading
 * its squad yet can be moved in from here.
 */
export function LineupPlanner({
  isAssigning,
  onAssign,
  records,
  survivors,
}: {
  isAssigning: boolean
  onAssign: (characterId: string, target: PendingSlot) => void
  records: ItemRecordMap
  survivors: Array<DecoratedSurvivor>
}) {
  const [scope, setScope] = useState<Scope>('damage')
  /**
   * The lineup being looked at, by identity rather than rank: a move
   * re-ranks the list, and the view must not jump to another lineup under
   * the click. Null follows whichever lineup is closest.
   */
  const [selected, setSelected] = useState<string | null>(null)

  const plans = useMemo(
    () => planLineups(survivors, { damageOnly: scope === 'damage' }),
    [scope, survivors]
  )
  const current = Math.max(
    0,
    plans.findIndex((entry) => lineupKey(entry.lineup) === selected)
  )
  const plan = plans[current]
  const show = (index: number) => setSelected(lineupKey(plans[index].lineup))
  const supports = useMemo(
    () => planSupports(survivors, plan.lineup),
    [plan, survivors]
  )
  const ownedLeads = useMemo(() => ownedMythicLeadCount(survivors), [survivors])

  return (
    <Panel>
      <PanelHeader
        actions={
          <>
            <Segmented
              onChange={(value) => {
                setScope(value)
                setSelected(null)
              }}
              options={[
                { label: 'Damage', value: 'damage' },
                { label: 'All', value: 'all' },
              ]}
              value={scope}
            />
            <span className="flex items-center gap-1">
              <Button
                aria-label="Previous lineup"
                disabled={current === 0}
                onClick={() => show(current - 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-12 text-center text-xs text-muted-foreground">
                <span className="figure">{current + 1}</span> /{' '}
                <span className="figure">{plans.length}</span>
              </span>
              <Button
                aria-label="Next lineup"
                disabled={current >= plans.length - 1}
                onClick={() => show(current + 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronRight className="size-4" />
              </Button>
            </span>
          </>
        }
        as="div"
        description={
          scope === 'damage'
            ? 'Each personality once, with Joel in Tech and Karolina in Offense. Closest lineup first.'
            : 'Each personality once, one Mythic lead per squad. Closest lineup first.'
        }
        title={
          <span className="flex items-center gap-2">
            Lineup planner
            <Chip tone={plan.owned === 8 ? 'success' : 'neutral'}>
              <span className="figure">{plan.owned}</span>/8 owned
            </Chip>
            <Chip>
              <span className="figure">{ownedLeads}</span>/
              <span className="figure">{mythicLeads.length}</span> Mythic leads
            </Chip>
          </span>
        }
      />
      <PanelBody className="space-y-3">
        <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
          {plan.slots.map((slot) => (
            <LeadCell
              isAssigning={isAssigning}
              key={slot.lead.key}
              onAssign={(characterId, target) => {
                show(current)
                onAssign(characterId, target)
              }}
              records={records}
              slot={slot}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {supports.map((support) => (
            <SupportRow key={support.key} records={records} support={support} />
          ))}
        </div>
      </PanelBody>
    </Panel>
  )
}

function LeadCell({
  isAssigning,
  onAssign,
  records,
  slot,
}: {
  isAssigning: boolean
  onAssign: (characterId: string, target: PendingSlot) => void
  records: ItemRecordMap
  slot: LineupSlot<DecoratedSurvivor>
}) {
  const { copy, lead, state } = slot
  const squadLabel = squadLabelsById[lead.squadId] ?? 'Squad'
  const emblem = badgeUrl(squadEmblems[lead.squadId] ?? '')
  const art = resolveItemArt(
    copy?.templateId ?? `Worker:${lead.key}_t05`,
    records,
    copy?.portrait ?? lead.portrait
  )
  const mark = personalityMark(lead.personality)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground">
        {emblem && <img alt="" className="size-4 shrink-0 object-contain" src={emblem} />}
        <span className="truncate" title={squadLabel}>
          {squadLabel}
        </span>
      </span>
      <Artboard
        className={cn(
          'aspect-square w-full rounded-md',
          state === 'slotted' && 'ring-2 ring-success/60',
          state === 'missing' && 'opacity-40 grayscale'
        )}
        rarity={art.rarity}
      >
        {art.imgUrl && (
          <img
            alt=""
            className="absolute inset-0 size-full object-cover object-top"
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        )}
        {mark && (
          <span className="absolute left-0.5 top-0.5">
            <BadgeMark className="size-4" mark={mark} />
          </span>
        )}
      </Artboard>
      <span className="min-w-0">
        <span className="block truncate text-ui font-semibold" title={lead.name}>
          {lead.short}
        </span>
        <span className="block truncate text-2xs text-muted-foreground" title={lead.personality}>
          {lead.personality}
        </span>
      </span>
      {state === 'slotted' ? (
        <Chip className="self-start" tone="success">
          Leading
        </Chip>
      ) : state === 'owned' && copy ? (
        <Button
          className="h-6 self-start px-2 text-xs"
          disabled={isAssigning}
          onClick={() =>
            onAssign(copy.itemId, {
              squadId: lead.squadId,
              slotIndex: squadLeaderSlotIndex,
            })
          }
          size="sm"
          title={`Make ${lead.short} the ${squadLabel} lead`}
          variant="outline"
        >
          Make lead
        </Button>
      ) : (
        <Chip className="self-start">Missing</Chip>
      )}
    </div>
  )
}

function SupportRow({
  records,
  support,
}: {
  records: ItemRecordMap
  support: SupportPlan<DecoratedSurvivor>
}) {
  const art = resolveItemArt(
    support.copy?.templateId ?? `Worker:${support.key}_t05`,
    records,
    support.copy?.portrait
  )
  const target = support.targetSquadId
    ? (squadLabelsById[support.targetSquadId] ?? 'its squad')
    : 'its squad'
  const where = support.copy?.squadId
    ? (squadLabelsById[support.copy.squadId] ?? 'another squad')
    : null
  const status = {
    placed: { label: 'In place', tone: 'success' },
    elsewhere: { label: `In ${where ?? 'another squad'}`, tone: 'warning' },
    vault: { label: 'Unassigned', tone: 'warning' },
    missing: { label: 'Not owned', tone: 'neutral' },
  } as const

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
      <Artboard
        className={cn(
          'size-10 shrink-0 rounded-md',
          support.state === 'missing' && 'opacity-40 grayscale'
        )}
        rarity={art.rarity}
      >
        {art.imgUrl && (
          <img
            alt=""
            className="absolute inset-0 size-full object-cover object-top"
            decoding="async"
            loading="lazy"
            src={art.imgUrl}
          />
        )}
      </Artboard>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-ui font-semibold"
          title={`${support.name} · ${support.personality}`}
        >
          {support.name}
          <span className="font-normal text-muted-foreground"> · {support.personality}</span>
        </span>
        <span className="block truncate text-2xs text-muted-foreground" title={`Belongs in ${target}`}>
          Belongs in {target}
        </span>
      </span>
      <Chip tone={status[support.state].tone}>{status[support.state].label}</Chip>
    </div>
  )
}
