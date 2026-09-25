import type { LockerSlotKey } from '../../../config/fortnite/locker'
import type { LockerSlotState } from '../../../kernel/core/locker'
import type { LockerView } from '../../../state/management/locker'
import type { SegmentedOption } from '../../../components/page'

import { Plus, Shirt, Sparkles, UserX } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'

import {
  lockerSlotCategories,
  slotLabels,
} from '../../../config/fortnite/locker'

import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RefreshButton,
  Segmented,
  StatRow,
  StatTile,
  ToolBadges,
} from '../../../components/page'

import { CardPanel } from './-card-panel'
import { Collection } from './-collection'
import { CosmeticTile } from './-cosmetic-tile'
import { Sidekicks } from './-sidekicks'
import { SlotPicker } from './-slot-picker'

import { useLockerStore } from '../../../state/management/locker'

import { useLockerPage, useOwnedForSlot } from './-hooks'

/** Every slot the loadout board draws — the denominator for "Slots filled". */
const slotTotal = lockerSlotCategories.reduce(
  (total, category) => total + category.slots.length,
  0
)

const viewOptions: Array<SegmentedOption<LockerView>> = [
  { label: 'Loadout', value: 'loadout' },
  { label: 'Collection', value: 'collection' },
  { label: 'Sidekicks', value: 'sidekicks' },
  { label: 'Card', value: 'card' },
]

export function RouteComponent() {
  return <Content />
}

function Content() {
  const {
    account,
    card,
    cardError,
    companions,
    companionsError,
    equipping,
    errorMessage,
    filters,
    handleEquip,
    handleGenerate,
    handleReload,
    isGenerating,
    isLoading,
    isLoadingCompanions,
    isLoadingOwned,
    owned,
    ownedError,
    progress,
    slots,
  } = useLockerPage()

  const { closePicker, openPicker, pickerSlot, setFilters, setView, view } =
    useLockerStore(
      useShallow((state) => ({
        closePicker: state.closePicker,
        openPicker: state.openPicker,
        pickerSlot: state.pickerSlot,
        setFilters: state.setFilters,
        setView: state.setView,
        view: state.view,
      }))
    )
  const pickerItems = useOwnedForSlot(owned, pickerSlot)
  const { t } = useTranslation(['sidebar'])

  const header = (
    <PageHeader
      actions={
        <RefreshButton
          disabled={!account}
          loading={isLoading || isLoadingOwned}
          onClick={handleReload}
        />
      }
      description="What this account is wearing, everything it owns, the sidekicks it is still missing, and the whole locker as one shareable image. Pick a slot to change it."
      icon={Shirt}
      section={t('account-management.title')}
      status={<ToolBadges beta />}
      title="BR Locker"
    />
  )

  if (!account) {
    return (
      <>
        {header}
        <EmptyState
          description="Pick one in the title bar and its locker loads here."
          icon={UserX}
          title="No account selected"
        />
      </>
    )
  }

  const equippedCount = lockerSlotCategories
    .flatMap((category) => category.slots)
    .filter((slotKey) => slots[slotKey]?.templateId).length
  const outfitCount = owned.filter(
    (cosmetic) => cosmetic.backendType === 'AthenaCharacter'
  ).length

  return (
    <>
      {header}

      {errorMessage && (
        <Callout
          title="Could not read the locker"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {ownedError && (
        <Callout
          title="Could not list owned cosmetics"
          tone="warning"
        >
          {ownedError}
        </Callout>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <StatRow>
          <StatTile
            icon={Sparkles}
            label="Owned"
            value={owned.length.toLocaleString()}
          />
          <StatTile
            icon={Shirt}
            label="Outfits"
            value={outfitCount.toLocaleString()}
          />
          <StatTile
            label="Slots filled"
            value={`${equippedCount} / ${slotTotal}`}
          />
        </StatRow>

        <Segmented
          onChange={setView}
          options={viewOptions}
          value={view}
        />
      </div>

      {view === 'loadout' &&
        lockerSlotCategories.map((category) => (
          <Panel key={category.label}>
            <PanelHeader
              compact
              title={category.label}
            />
            <PanelBody>
              <div className="flex flex-wrap gap-2">
                {category.slots.map((slotKey) => (
                  <SlotBoardTile
                    key={slotKey}
                    isBusy={equipping === slotKey}
                    onPick={() => openPicker(slotKey)}
                    slot={slots[slotKey] ?? null}
                    slotKey={slotKey}
                  />
                ))}
              </div>
            </PanelBody>
          </Panel>
        ))}

      {view === 'collection' && (
        <Collection
          isLoading={isLoadingOwned}
          owned={owned}
        />
      )}

      {view === 'sidekicks' && (
        <Sidekicks
          companions={companions}
          errorMessage={companionsError}
          isLoading={isLoadingCompanions}
        />
      )}

      {view === 'card' && (
        <CardPanel
          card={card}
          errorMessage={cardError}
          filters={filters}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          onUpdateFilters={setFilters}
          owned={owned}
          progress={progress}
        />
      )}

      <SlotPicker
        equippedTemplateId={
          pickerSlot ? (slots[pickerSlot]?.templateId ?? null) : null
        }
        isEquipping={equipping !== null}
        items={pickerItems}
        onClose={closePicker}
        onPick={(templateId, itemName) => {
          if (pickerSlot) {
            handleEquip(pickerSlot, templateId, itemName)
          }

          closePicker()
        }}
        slotKey={pickerSlot}
      />
    </>
  )
}

/**
 * One slot on the board — filled or not.
 *
 * The empty state is drawn here rather than with `EmptySlot` so both states
 * are the same size: `EmptySlot`'s two sizes are 64 and 128 square, and a
 * cosmetic tile is 112 wide plus a caption strip, so mixing them would leave
 * a filled row and an empty row on different baselines.
 */
function SlotBoardTile({
  isBusy,
  onPick,
  slot,
  slotKey,
}: {
  isBusy: boolean
  onPick: () => void
  slot: LockerSlotState | null
  slotKey: LockerSlotKey
}) {
  if (!slot?.templateId) {
    return (
      <button
        className="flex w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 py-6 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        disabled={isBusy}
        onClick={onPick}
        type="button"
      >
        <Plus className="size-4" />
        <span className="micro-label px-1 text-center">
          {slotLabels[slotKey]}
        </span>
      </button>
    )
  }

  return (
    <CosmeticTile
      cosmetic={{
        color: slot.color,
        imageUrl: slot.imageUrl,
        name: slot.name ?? slot.templateId,
        rarity: slot.rarity ?? 'common',
        seriesColors: slot.seriesColors,
      }}
      disabled={isBusy}
      footer={slotLabels[slotKey]}
      onClick={onPick}
    />
  )
}
