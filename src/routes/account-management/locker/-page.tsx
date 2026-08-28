import type { LockerSlotKey } from '../../../config/fortnite/locker'
import type { LockerSlotState } from '../../../kernel/core/locker'

import { Plus, RotateCw, Shirt, Sparkles, UserX } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'

import {
  lockerSlotCategories,
  slotLabels,
} from '../../../config/fortnite/locker'

import { Button } from '../../../components/ui/button'
import {
  AccountToolbar,
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  StatRow,
  StatTile,
} from '../../../components/page'
import { BetaBadge } from '../../../components/navigation/beta-badge'

import { CardPanel } from './-card-panel'
import { CosmeticTile } from './-cosmetic-tile'
import { SlotPicker } from './-slot-picker'

import { useLockerStore } from '../../../state/management/locker'

import { useLockerPage, useOwnedForSlot } from './-hooks'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        description="What this account is wearing, and everything it owns. Pick a slot to change it, or draw the whole locker as one image."
        icon={Shirt}
        section={t('account-management.title')}
        title={
          <span className="flex items-center gap-2">
            BR Locker
            <BetaBadge />
          </span>
        }
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    account,
    card,
    cardError,
    equipping,
    errorMessage,
    filters,
    handleEquip,
    handleGenerate,
    handleReload,
    isGenerating,
    isLoading,
    isLoadingOwned,
    owned,
    ownedError,
    progress,
    slots,
  } = useLockerPage()

  const { closePicker, openPicker, pickerSlot, setFilters } = useLockerStore(
    useShallow((state) => ({
      closePicker: state.closePicker,
      openPicker: state.openPicker,
      pickerSlot: state.pickerSlot,
      setFilters: state.setFilters,
    }))
  )
  const pickerItems = useOwnedForSlot(owned, pickerSlot)

  if (!account) {
    return (
      <EmptyState
        description="Pick one in the title bar and its locker loads here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  const equippedCount = Object.values(slots).filter(
    (slot) => slot.templateId
  ).length
  const outfitCount = owned.filter(
    (cosmetic) => cosmetic.backendType === 'AthenaCharacter'
  ).length

  return (
    <>
      <Panel>
        <PanelBody>
          <AccountToolbar
            account={account}
            actions={
              <Button
                disabled={isLoading || isLoadingOwned}
                onClick={handleReload}
                variant="outline"
              >
                <RotateCw
                  className={
                    isLoading || isLoadingOwned
                      ? 'mr-2 size-4 animate-spin'
                      : 'mr-2 size-4'
                  }
                />
                Reload
              </Button>
            }
          />
        </PanelBody>
      </Panel>

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
          value={equippedCount}
        />
      </StatRow>

      {lockerSlotCategories.map((category) => (
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
