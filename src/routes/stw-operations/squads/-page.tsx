import type { SquadsPayload } from '../../../kernel/core/squads'

import { Users, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AccountResourceGate,
  PageHeader,
  PageTabPanel,
  PageTabs,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../../components/page'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogContent } from '../../../components/ui/dialog'

import { useRequestItemDatabase } from '../../../bootstrap/components/load-item-database'
import { AutoFillReview } from './-auto-fill'
import { LineupPlanner } from './-lineup-planner'
import { SlotPicker } from './-slot-picker'
import { SquadCard } from './-squad-card'
import { SetBonusStrip } from './-squad-parts'

import { useSquads, useSquadsResource } from './-hooks'

import { fortStats } from '../../../config/constants/fortnite/fort'
import {
  squadSlotCount,
  survivorSquads,
} from '../../../config/constants/fortnite/squads'

type Tab = 'squads' | 'planner'

const allSquadIds = survivorSquads.map((squad) => squad.id)

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
        description="What every survivor adds to F.O.R.T., and the best pick for each slot."
        icon={Users}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.squad-presets')}
      />
      <AccountResourceGate
        icon={Users}
        loading={{
          title: 'Loading the squads…',
          description: 'Reading every survivor on the account.',
        }}
        resource={resource}
        what="the squads"
      >
        {(data) => (
          <Squads key={data.accountId} onAssigned={followUp} payload={data} />
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
    applyFill,
    cancelFill,
    candidates,
    fill,
    fort,
    handleAssign,
    handleAssignTo,
    handleClearSlot,
    isAssigning,
    occupant,
    pendingSlot,
    previewFill,
    records,
    setPendingSlot,
    squads,
    survivors,
    totalFilled,
  } = useSquads(payload, onAssigned)

  const [tab, setTab] = useState<Tab>('squads')
  const pendingSquad = pendingSlot
    ? squads.find((entry) => entry.id === pendingSlot.squadId)
    : null

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <StatRow>
            {fortStats.map((stat) => (
              <StatTile
                key={stat.key}
                label={stat.label}
                value={Math.round(fort[stat.key]).toLocaleString()}
              />
            ))}
          </StatRow>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              <span className="figure">{totalFilled}</span> of{' '}
              {squadSlotCount * allSquadIds.length} slots filled
            </span>
            <Button
              disabled={isAssigning}
              onClick={() => previewFill(allSquadIds)}
            >
              <Wand2 className="size-4" />
              Auto-fill all
            </Button>
          </div>
        </div>
        <SetBonusStrip squads={squads} />
      </div>

      <PageTabs
        label="Squads"
        onValueChange={setTab}
        tabs={[
          { value: 'squads', label: 'Squads' },
          { value: 'planner', label: 'Lineup planner' },
        ]}
        value={tab}
      >
        <PageTabPanel activeValue={tab} value="squads">
          {/*
            Every squad on the page at once, paired by the F.O.R.T. stat they
            feed, as the game's own squad screen groups them.
          */}
          {fortStats.map((stat) => {
            const group = squads.filter((entry) => entry.stat === stat.key)

            return (
              <section className="space-y-2" key={stat.key}>
                <p className="flex items-baseline gap-2 text-ui font-semibold">
                  <span style={{ color: stat.color }}>{stat.label}</span>
                  <span className="figure text-muted-foreground">
                    {Math.round(fort[stat.key]).toLocaleString()}
                  </span>
                </p>
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  {group.map((squad) => (
                    <SquadCard
                      isAssigning={isAssigning}
                      key={squad.id}
                      onAutoFill={() => previewFill([squad.id])}
                      onClear={(slotIndex) =>
                        handleClearSlot(squad.id, slotIndex)
                      }
                      onPick={(slotIndex) =>
                        setPendingSlot({ squadId: squad.id, slotIndex })
                      }
                      records={records}
                      squad={squad}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </PageTabPanel>
        <PageTabPanel activeValue={tab} value="planner">
          <LineupPlanner
            isAssigning={isAssigning}
            onAssign={handleAssignTo}
            records={records}
            survivors={survivors}
          />
        </PageTabPanel>
      </PageTabs>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingSlot(null)
          }
        }}
        open={pendingSlot !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {pendingSlot && pendingSquad && (
            <SlotPicker
              candidates={candidates}
              isAssigning={isAssigning}
              occupant={occupant}
              onAssign={handleAssign}
              onClear={() =>
                handleClearSlot(pendingSlot.squadId, pendingSlot.slotIndex)
              }
              pendingSlot={pendingSlot}
              records={records}
              squad={pendingSquad}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            cancelFill()
          }
        }}
        open={fill !== null}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {fill && (
            <AutoFillReview
              isAssigning={isAssigning}
              onApply={applyFill}
              onCancel={cancelFill}
              plan={fill.plan}
              squadIds={fill.squadIds}
              squads={squads}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
