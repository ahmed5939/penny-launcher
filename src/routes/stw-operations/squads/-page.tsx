import type { SquadView } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Crown, RefreshCw, Swords, UserX, Users, X, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { ItemTile } from '../../../components/items/item-tile'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useSquadsData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

/** Which F.O.R.T. stat each squad feeds, in the game's own words. */
const attributeLabels: Record<string, string> = {
  arms: 'Offense',
  medicine: 'Fortitude',
  scavenging: 'Tech',
  synthesis: 'Resistance',
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={Swords}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.squad-presets')}
        description="All eight survivor squads. Click a slot to fill it, and match personalities to the squad lead for the full bonus."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    account,
    candidates,
    errorMessage,
    handleAssign,
    handleClearSlot,
    handleLoad,
    hasLoaded,
    isAssigning,
    isLoading,
    pendingSlot,
    records,
    setPendingSlot,
    squads,
    totalFilled,
    totalPower,
    unassigned,
  } = useSquadsData()

  if (!account) {
    return (
      <EmptyState
        description="Pick one in the title bar and its squads load here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  return (
    <>
      <Panel id="squads-card">
        <PanelBody className="flex flex-wrap items-center gap-3">
          <span className="text-[0.8125rem] font-medium">
            {parseCustomDisplayName(account)}
          </span>
          <Button
            className="ml-auto"
            disabled={isLoading}
            onClick={handleLoad}
            size="sm"
            variant="ghost"
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Refresh
              </>
            )}
          </Button>
        </PanelBody>
      </Panel>

      {errorMessage && (
        <Callout
          title="Could not read the squads"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {hasLoaded && !errorMessage && (
        <>
          <StatRow className="lg:grid-cols-3">
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

          <div className="grid gap-3 xl:grid-cols-2">
            {squads.map((squad) => (
              <SquadCard
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
        </>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null)
          }
        }}
        open={pendingSlot !== null}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {pendingSlot?.slotIndex === 0
                ? 'Pick a squad lead'
                : 'Pick a survivor'}
            </DialogTitle>
            <DialogDescription>
              {pendingSlot?.slotIndex === 0
                ? 'Only lead survivors can hold the leader slot.'
                : 'Anyone already in another squad will be moved out of it.'}
            </DialogDescription>
          </DialogHeader>

          {candidates.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {candidates.map((survivor) => (
                <ItemTile
                  disabled={isAssigning}
                  footer={survivor.personality}
                  key={survivor.itemId}
                  name={survivor.name}
                  onClick={() => handleAssign(survivor.itemId)}
                  portrait={survivor.portrait}
                  power={survivor.power}
                  records={records}
                  size="small"
                  templateId={survivor.templateId}
                  title={
                    survivor.squadId
                      ? 'Currently in another squad'
                      : survivor.name
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              className="border-0 bg-transparent py-6"
              description="This account has no survivor that fits the slot."
              icon={Users}
              title="Nobody available"
            />
          )}
        </DialogContent>
      </Dialog>

      <GoToTop containerId="squads-card" />
    </>
  )
}

function SquadCard({
  onClear,
  onPick,
  records,
  squad,
}: {
  onClear: (squadId: string, slotIndex: number) => void
  onPick: (slotIndex: number) => void
  records: ItemRecordMap
  squad: SquadView
}) {
  return (
    <Panel>
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
        <p className="text-[0.8125rem] font-semibold">{squad.label}</p>
        <span className="rounded border border-border/70 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {attributeLabels[squad.attribute] ?? squad.attribute}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs font-semibold tabular-nums">
          <Zap className="size-3 text-yellow-300" />
          {squad.power.toLocaleString()}
        </span>
        <span className="text-[0.65rem] text-muted-foreground">
          {squad.filled}/8
        </span>
      </header>

      <PanelBody className="flex flex-wrap gap-2">
        {squad.slots.map((slot) => (
          <div
            className="relative"
            key={slot.slotIndex}
          >
            {slot.survivor ? (
              <>
                <ItemTile
                  className={cn(
                    slot.matchesLead === true && 'ring-2 ring-success/60',
                    slot.matchesLead === false && 'ring-2 ring-warning/50'
                  )}
                  footer={slot.survivor.personality}
                  name={slot.survivor.name}
                  onClick={() => onPick(slot.slotIndex)}
                  portrait={slot.survivor.portrait}
                  power={slot.survivor.power}
                  records={records}
                  size="small"
                  templateId={slot.survivor.templateId}
                  title={
                    slot.matchesLead === true
                      ? 'Personality matches the lead — full bonus'
                      : slot.matchesLead === false
                        ? 'Personality does not match the lead'
                        : slot.survivor.name
                  }
                />
                <button
                  aria-label="Remove from squad"
                  className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive"
                  onClick={() => onClear(squad.id, slot.slotIndex)}
                  type="button"
                >
                  <X className="size-2.5" />
                </button>
              </>
            ) : (
              <button
                className={cn(
                  'grid size-16 place-items-center gap-0.5 rounded-lg border-2 border-dashed',
                  'border-border/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary'
                )}
                onClick={() => onPick(slot.slotIndex)}
                type="button"
              >
                {slot.slotIndex === 0 ? (
                  <Crown className="size-4" />
                ) : (
                  <span className="text-lg leading-none">+</span>
                )}
                <span className="text-[0.5rem] uppercase tracking-wide">
                  {slot.slotIndex === 0 ? 'Lead' : 'Empty'}
                </span>
              </button>
            )}
          </div>
        ))}
      </PanelBody>
    </Panel>
  )
}
