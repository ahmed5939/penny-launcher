import type {
  AlterationSlotPool,
  ItemRecordMap,
} from '../../kernel/core/item-database'
import type { ItemActionRequest } from '../../kernel/core/item-actions'
import type { RatingTables } from '../../config/constants/fortnite/power'

import {
  ArrowUp,
  Lock,
  Recycle,
  RefreshCw,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react'
import { useState } from 'react'

import { Button } from '../ui/button'

import { ItemIcon, resolveItemArt } from './item-icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

import { getItemRecord } from '../../state/items/database'

import { computeItemPower } from '../../config/constants/fortnite/power'
import { peglegImageURL } from '../../config/constants/pegleg'
import { RarityType } from '../../config/constants/resources'

import { cn } from '../../lib/utils'

const rarityText: Record<string, string> = {
  [RarityType.Common]: 'text-[#9ba0a5]',
  [RarityType.Uncommon]: 'text-[#5ecc32]',
  [RarityType.Rare]: 'text-[#43aff5]',
  [RarityType.Epic]: 'text-[#b054e8]',
  [RarityType.Legendary]: 'text-[#f5a742]',
  [RarityType.Mythic]: 'text-[#f5e142]',
}

export type ItemDetailSubject = {
  templateId: string
  /**
   * The owned copy's GUID. Every modification targets this, so its absence
   * is what marks a compendium entry as read-only.
   */
  itemId?: string
  /** From the account's own copy, when this is an owned item. */
  level?: number
  tier?: number
  lockedReason?: 'favorite' | 'in-use' | null
  personality?: string | null
  setBonus?: string | null
  /** `Alteration:` ids rolled on this copy. */
  alterations?: Array<string>
}

/**
 * Everything the game would tell you about one item.
 *
 * The vault grid deliberately shows almost nothing — art, name, level — so
 * this is where the description, perks, abilities, crafting cost and recycle
 * value live, in one place, the way inspecting an item in game does.
 */
export function ItemDetailDialog({
  alterationPools,
  isBusy,
  onAction,
  onOpenChange,
  ratings,
  records,
  subject,
}: {
  alterationPools?: Record<string, Array<AlterationSlotPool>>
  /** An action is in flight — every button waits. */
  isBusy?: boolean
  /**
   * Omit to render read-only. Provided, it enables levelling, evolving and
   * perk work on the owned copy.
   */
  onAction?: (request: ItemActionRequest) => void
  onOpenChange: (open: boolean) => void
  ratings?: RatingTables
  records: ItemRecordMap
  subject: ItemDetailSubject | null
}) {
  const record = subject ? getItemRecord(records, subject.templateId) : null
  const art = subject
    ? resolveItemArt(subject.templateId, records)
    : null
  const power =
    subject && typeof subject.level === 'number'
      ? computeItemPower({
          level: subject.level,
          tables: ratings,
          templateId: subject.templateId,
        })
      : null

  return (
    <Dialog
      onOpenChange={onOpenChange}
      open={subject !== null}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {subject && art && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                <span className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border-2 border-border">
                  {art.frame && (
                    <img
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full object-cover"
                      src={art.frame}
                    />
                  )}
                  <img
                    alt=""
                    className="relative size-full object-contain"
                    src={
                      record?.largeImage
                        ? peglegImageURL(record.largeImage)
                        : art.imgUrl
                    }
                  />
                </span>

                <div className="min-w-0 flex-1 text-left">
                  <DialogTitle className="text-left text-lg leading-tight">
                    {art.name}
                  </DialogTitle>
                  <p
                    className={cn(
                      'mt-1 text-xs font-semibold uppercase tracking-wide',
                      rarityText[art.rarity]
                    )}
                  >
                    {[
                      record?.rarity,
                      record?.subType,
                      record?.displayTier,
                      (subject.tier ?? record?.tier ?? 0) > 0 &&
                        `Tier ${subject.tier ?? record?.tier}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {power !== null && (
                    <p className="mt-1.5 flex items-center gap-1 text-base font-bold leading-none">
                      <Zap className="size-4 text-yellow-300" />
                      {power}
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                        Power
                      </span>
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {typeof subject.level === 'number' && (
                      <span>Level {subject.level}</span>
                    )}
                    {subject.personality && (
                      <span>{subject.personality}</span>
                    )}
                    {subject.setBonus && <span>{subject.setBonus}</span>}
                  </p>
                </div>
              </div>

              {record?.description && (
                <DialogDescription className="mt-3 whitespace-pre-line text-left leading-relaxed">
                  {record.description}
                </DialogDescription>
              )}
            </DialogHeader>

            {subject.lockedReason && (
              <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/[0.07] px-3 py-2 text-xs">
                <Lock className="size-3.5 shrink-0 text-warning" />
                {subject.lockedReason === 'favorite'
                  ? 'Favourited in game — protected from recycling.'
                  : 'Assigned to a squad or hero loadout — protected from recycling.'}
              </p>
            )}

            {onAction && subject.itemId && (
              <UpgradeActions
                isBusy={isBusy}
                onAction={onAction}
                record={record}
                subject={subject}
              />
            )}

            {subject.alterations && subject.alterations.length > 0 && (
              <Section
                icon={Sparkles}
                title="Perks on this copy"
              >
                <ul className="space-y-1.5">
                  {subject.alterations.map((alteration, index) => (
                    <PerkRow
                      alteration={alteration}
                      isBusy={isBusy}
                      key={`${alteration}-${index}`}
                      onAction={subject.itemId ? onAction : undefined}
                      pool={
                        record?.alterationRow
                          ? alterationPools?.[record.alterationRow]?.[index]
                          : undefined
                      }
                      records={records}
                      slotIndex={index}
                      subject={subject}
                    />
                  ))}
                </ul>
              </Section>
            )}

            {record?.perk && (
              <PerkBlock
                icon={Star}
                label="Hero perk"
                perk={record.perk}
              />
            )}

            {record?.commanderPerk && (
              <PerkBlock
                icon={Sparkles}
                label="Commander perk"
                perk={record.commanderPerk}
              />
            )}

            {record && record.abilities.length > 0 && (
              <Section
                icon={Sparkles}
                title="Abilities"
              >
                <ul className="flex flex-wrap gap-2">
                  {record.abilities.map((ability) => {
                    const known = getItemRecord(records, ability)

                    return (
                      <li
                        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/50 py-1 pl-1 pr-2.5 text-xs"
                        key={ability}
                      >
                        <ItemIcon
                          records={records}
                          size="small"
                          templateId={ability}
                        />
                        {known?.name ?? ability.split(':').pop()}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            )}

            {record && Object.keys(record.craftingCost).length > 0 && (
              <CostSection
                icon={Wrench}
                cost={record.craftingCost}
                records={records}
                title="Crafting cost"
              />
            )}

            {record && Object.keys(record.tierUpCost).length > 0 && (
              <CostSection
                icon={Star}
                cost={record.tierUpCost}
                records={records}
                title="Next tier costs"
              />
            )}

            {record?.recycle && (
              <Section
                icon={Recycle}
                title="Recycles for"
              >
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  <ItemIcon
                    records={records}
                    templateId={record.recycle.result}
                  />
                  {record.recycle.amount.toLocaleString()}{' '}
                  {getItemRecord(records, record.recycle.result)?.name ?? ''}
                </span>
              </Section>
            )}

            <p className="select-all break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
              {subject.templateId}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Lowercase roman numerals — what `UpgradeItemBulk` wants for a tier. */
const romanTiers = ['i', 'ii', 'iii', 'iv', 'v']

/**
 * Levelling, evolving and rarity, each spending materials the moment it is
 * pressed. Costs are shown next to the button rather than buried, because
 * the whole point of doing this outside the game is knowing what it costs.
 */
function UpgradeActions({
  isBusy,
  onAction,
  record,
  subject,
}: {
  isBusy?: boolean
  onAction: (request: ItemActionRequest) => void
  record: ReturnType<typeof getItemRecord>
  subject: ItemDetailSubject
}) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const tier = subject.tier ?? record?.tier ?? 0
  const canEvolve = tier > 0 && tier < 5
  const canUpgradeRarity = Object.keys(record?.upgradeCost ?? {}).length > 0

  const act = (key: string, request: ItemActionRequest) => {
    if (confirming !== key) {
      setConfirming(key)

      return
    }

    setConfirming(null)
    onAction(request)
  }

  const label = (key: string, idle: string) =>
    confirming === key ? 'Confirm — spends materials' : idle

  return (
    <Section
      icon={ArrowUp}
      title="Upgrade"
    >
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={isBusy}
          onClick={() =>
            act('level', { kind: 'level', itemId: subject.itemId as string })
          }
          size="sm"
          variant={confirming === 'level' ? 'destructive' : 'secondary'}
        >
          <ArrowUp className="size-3.5" />
          {label('level', 'Level +1')}
        </Button>

        {canEvolve && (
          <Button
            disabled={isBusy}
            onClick={() =>
              act('evolve', {
                kind: 'evolve',
                itemId: subject.itemId as string,
                desiredLevel: subject.level ?? 1,
                desiredTier: romanTiers[tier] ?? 'no_tier',
                conversionIndex: 0,
              })
            }
            size="sm"
            variant={confirming === 'evolve' ? 'destructive' : 'secondary'}
          >
            <Star className="size-3.5" />
            {label('evolve', `Evolve to tier ${tier + 1}`)}
          </Button>
        )}

        {canUpgradeRarity && (
          <Button
            disabled={isBusy}
            onClick={() =>
              act('rarity', { kind: 'rarity', itemId: subject.itemId as string })
            }
            size="sm"
            variant={confirming === 'rarity' ? 'destructive' : 'secondary'}
          >
            <Sparkles className="size-3.5" />
            {label('rarity', 'Upgrade rarity')}
          </Button>
        )}
      </div>

      {confirming && (
        <p className="text-[0.65rem] text-muted-foreground">
          Press again to go ahead, or click elsewhere to leave it.
        </p>
      )}
    </Section>
  )
}

/**
 * One perk slot: what is rolled, what upgrading it costs, and — when the
 * game data knows the slot's pool — what else could go there.
 */
function PerkRow({
  alteration,
  isBusy,
  onAction,
  pool,
  records,
  slotIndex,
  subject,
}: {
  alteration: string
  isBusy?: boolean
  onAction?: (request: ItemActionRequest) => void
  pool?: AlterationSlotPool
  records: ItemRecordMap
  slotIndex: number
  subject: ItemDetailSubject
}) {
  const [swapping, setSwapping] = useState(false)

  const perkRecord = getItemRecord(records, alteration)
  const upgrade = perkRecord?.upgradeCost ?? {}
  const options = (pool?.options ?? []).filter(
    (option) => option !== alteration
  )

  return (
    <li className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1.5 size-1.5 shrink-0 rounded-full',
            perkRecord?.rarity === 'Legendary'
              ? 'bg-[#f5a742]'
              : perkRecord?.rarity === 'Epic'
                ? 'bg-[#b054e8]'
                : perkRecord?.rarity === 'Rare'
                  ? 'bg-[#43aff5]'
                  : 'bg-muted-foreground'
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {perkRecord?.name ?? alteration.split(':').pop()}
          </p>

          {Object.keys(upgrade).length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.65rem] text-muted-foreground">
              <span>Upgrade costs</span>
              {Object.entries(upgrade).map(([costId, amount]) => (
                <span
                  className="inline-flex items-center gap-1 tabular-nums"
                  key={costId}
                >
                  <ItemIcon
                    records={records}
                    size="small"
                    templateId={costId}
                  />
                  {amount.toLocaleString()}
                </span>
              ))}
            </p>
          )}
        </div>

        {onAction && (
          <div className="flex shrink-0 gap-1">
            {Object.keys(upgrade).length > 0 && (
              <Button
                disabled={isBusy}
                onClick={() =>
                  onAction({
                    kind: 'perk-upgrade',
                    itemId: subject.itemId as string,
                    alterationSlot: slotIndex,
                  })
                }
                size="sm"
                title="Upgrade this perk one rarity"
                variant="ghost"
              >
                <ArrowUp className="size-3.5" />
              </Button>
            )}
            {options.length > 0 && (
              <Button
                disabled={isBusy}
                onClick={() => setSwapping(!swapping)}
                size="sm"
                title="Change this perk"
                variant="ghost"
              >
                <RefreshCw className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {swapping && onAction && (
        <div className="mt-2 space-y-1.5 border-t border-border/50 pt-2">
          {Object.keys(pool?.respecCost ?? {}).length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[0.65rem] text-muted-foreground">
              <span>Each change costs</span>
              {Object.entries(pool?.respecCost ?? {}).map(
                ([costId, amount]) => (
                  <span
                    className="inline-flex items-center gap-1 tabular-nums"
                    key={costId}
                  >
                    <ItemIcon
                      records={records}
                      size="small"
                      templateId={costId}
                    />
                    {amount.toLocaleString()}
                  </span>
                )
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <button
                className="rounded-md border border-border/70 px-2 py-1 text-[0.65rem] transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                disabled={isBusy}
                key={option}
                onClick={() => {
                  setSwapping(false)
                  onAction({
                    kind: 'perk-respec',
                    itemId: subject.itemId as string,
                    alterationSlot: slotIndex,
                    alterationId: option,
                  })
                }}
                type="button"
              >
                {getItemRecord(records, option)?.name ??
                  option.split(':').pop()}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  )
}

function Section({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode
  icon: typeof Star
  title: string
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="size-3" />
        {title}
      </p>
      {children}
    </div>
  )
}

function PerkBlock({
  icon,
  label,
  perk,
}: {
  icon: typeof Star
  label: string
  perk: { name: string; description: string | null }
}) {
  return (
    <Section
      icon={icon}
      title={label}
    >
      <div className="rounded-lg border border-border/60 bg-surface/50 px-3 py-2">
        <p className="text-[0.8125rem] font-semibold">{perk.name}</p>
        {perk.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {perk.description}
          </p>
        )}
      </div>
    </Section>
  )
}

function CostSection({
  cost,
  icon,
  records,
  title,
}: {
  cost: Record<string, number>
  icon: typeof Star
  records: ItemRecordMap
  title: string
}) {
  return (
    <Section
      icon={icon}
      title={title}
    >
      <ul className="flex flex-wrap gap-2">
        {Object.entries(cost).map(([templateId, amount]) => (
          <li
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/50 py-1 pl-1 pr-2.5 text-xs tabular-nums"
            key={templateId}
          >
            <ItemIcon
              records={records}
              size="small"
              templateId={templateId}
            />
            {amount.toLocaleString()}
            <span className="text-muted-foreground">
              {getItemRecord(records, templateId)?.name ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
