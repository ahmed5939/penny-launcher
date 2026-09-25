import type { DecoratedSurvivor, PendingSlot } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { SquadsPayload } from '../../../kernel/core/squads'

import { Crown, Swords, Users, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GoToTop } from '../../../components/go-to-top'
import { ItemCard, ItemCardGrid } from '../../../components/items/item-card'
import { DetailHeader, DetailSection } from '../../../components/items/detail-parts'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  AccountResourceGate,
  Chip,
  EmptyState,
  PageHeader,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { SetBonusBoard, SquadCard } from './-squad-card'

import { useSquads, useSquadsResource } from './-hooks'

import { survivorSquads } from '../../../config/constants/fortnite/squads'

import { cn } from '../../../lib/utils'

const squadLabels = new Map(
  survivorSquads.map((squad) => [squad.id, squad.label])
)

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  useRequestItemDatabase()
  const { followUp, resource } = useSquadsResource()

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <RefreshButton
            disabled={!resource.accountId}
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
        description="All eight survivor squads. Click a slot to fill it, and match personalities to the squad lead for the full bonus."
        icon={Users}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.squad-presets')}
      />
      <AccountResourceGate
        icon={Users}
        loading={{
          title: 'Loading the squads…',
          description: 'Reading every survivor on the account from Epic.',
        }}
        resource={resource}
        what="the squads"
      >
        {(data) => (
          <Squads
            key={data.accountId}
            onAssigned={followUp}
            payload={data}
          />
        )}
      </AccountResourceGate>
    </div>
  )
}

function Squads({
  onAssigned,
  payload,
}: {
  onAssigned: () => void
  payload: SquadsPayload
}) {
  const {
    candidates,
    handleAssign,
    handleClearSlot,
    isAssigning,
    occupant,
    pendingSlot,
    records,
    setPendingSlot,
    squads,
    totalFilled,
    totalPower,
    unassigned,
  } = useSquads(payload, onAssigned)

  return (
    <>
      <div id="squads-top">
        <StatRow>
          <StatTile
            hint="Across all eight squads"
            icon={Zap}
            label="Survivor power"
            tone="primary"
            value={totalPower.toLocaleString()}
          />
          <StatTile
            icon={Users}
            label="Slots filled"
            value={`${totalFilled} / 64`}
          />
          <StatTile
            icon={Swords}
            label="Unassigned survivors"
            value={unassigned.length}
          />
        </StatRow>
      </div>

      <SetBonusBoard squads={squads} />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-3">
        {squads.map((squad) => (
          <SquadCard
            isAssigning={isAssigning}
            key={squad.id}
            onClear={handleClearSlot}
            onPick={(slotIndex) =>
              setPendingSlot({ squadId: squad.id, slotIndex })
            }
            records={records}
            squad={squad}
          />
        ))}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Moves save to the account as soon as you pick a survivor. The lead
        wears the accent ring; an amber ring means a survivor's personality
        does not match the lead. Squad power adds up item power only — set
        bonuses and the lead bonus are not included. Set bonus sizes and
        percentages follow the table PennyDB publishes.
      </p>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null)
          }
        }}
        open={pendingSlot !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {pendingSlot && (
            <SlotPicker
              candidates={candidates}
              isAssigning={isAssigning}
              occupant={occupant}
              onAssign={handleAssign}
              pendingSlot={pendingSlot}
              records={records}
            />
          )}
        </DialogContent>
      </Dialog>

      <GoToTop containerId="squads-top" />
    </>
  )
}

function SlotPicker({
  candidates,
  isAssigning,
  occupant,
  onAssign,
  pendingSlot,
  records,
}: {
  candidates: Array<DecoratedSurvivor>
  isAssigning: boolean
  occupant: DecoratedSurvivor | null
  onAssign: (characterId: string) => void
  pendingSlot: PendingSlot
  records: ItemRecordMap
}) {
  const wantsLead = pendingSlot.slotIndex === 0
  const squadLabel = squadLabels.get(pendingSlot.squadId) ?? 'Squad'
  const slotLabel = wantsLead ? 'Squad lead' : `Slot ${pendingSlot.slotIndex}`
  const hint = wantsLead
    ? 'Only lead survivors can hold the leader slot.'
    : 'Anyone already in another squad will be moved out of it.'

  return (
    <>
      {occupant ? (
        <DetailHeader
          facts={
            <>
              <span>
                Level <span className="figure">{occupant.level}</span>
              </span>
              {occupant.personality && (
                <span>Personality: {occupant.personality}</span>
              )}
            </>
          }
          meta={[squadLabel, slotLabel]}
          name={occupant.name}
          portrait={occupant.portrait}
          power={occupant.power}
          records={records}
          templateId={occupant.templateId}
        />
      ) : (
        <DialogHeader>
          <DialogTitle>
            {wantsLead ? 'Pick a squad lead' : 'Pick a survivor'}
          </DialogTitle>
          <DialogDescription>
            {squadLabel} · {slotLabel}. {hint}
          </DialogDescription>
        </DialogHeader>
      )}

      <DetailSection
        icon={wantsLead ? Crown : Users}
        title={
          occupant
            ? wantsLead
              ? 'Swap in another lead'
              : 'Swap in another survivor'
            : wantsLead
              ? 'Lead survivors'
              : 'Survivors'
        }
      >
        {occupant && <p className="text-xs text-muted-foreground">{hint}</p>}
        {candidates.length > 0 ? (
          <ItemCardGrid
            className={cn(
              'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4',
              isAssigning && 'pointer-events-none opacity-60'
            )}
          >
            {candidates.map((survivor) => {
              const isCurrent = survivor.itemId === occupant?.itemId
              const elsewhere =
                survivor.squadId && !isCurrent
                  ? (squadLabels.get(survivor.squadId) ?? 'Another squad')
                  : null

              return (
                <ItemCard
                  badges={
                    isCurrent ? (
                      <Chip tone="accent">In this slot</Chip>
                    ) : elsewhere ? (
                      <Chip>In {elsewhere}</Chip>
                    ) : undefined
                  }
                  key={survivor.itemId}
                  level={survivor.level}
                  name={survivor.name}
                  onClick={() => onAssign(survivor.itemId)}
                  personality={survivor.personality}
                  portrait={survivor.portrait}
                  power={survivor.power}
                  records={records}
                  setBonus={survivor.setBonus}
                  subtitle={survivor.caption ?? undefined}
                  templateId={survivor.templateId}
                  title={
                    elsewhere
                      ? `${survivor.name} · currently in ${elsewhere}`
                      : survivor.name
                  }
                />
              )
            })}
          </ItemCardGrid>
        ) : (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description="This account has no survivor that fits the slot."
            icon={Users}
            title="Nobody available"
          />
        )}
      </DetailSection>
    </>
  )
}
