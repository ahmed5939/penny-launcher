import type {
  AlterationSlotPool,
  ItemRecordMap,
} from '../../kernel/core/item-database'
import type { ItemActionRequest } from '../../kernel/core/item-actions'
import type { RatingTables } from '../../config/constants/fortnite/power'

import {
  ArrowUp,
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
import { Callout } from '../page'
import {
  accentByRarity,
  rarityStyle,
  rarityTypeFromName,
} from '../page/rarity'

import { getItemRecord } from '../../state/items/database'

import { computeItemPower } from '../../config/constants/fortnite/power'

import { cn } from '../../lib/utils'

/**
 * The database spells a rarity as the word a player reads ("Legendary"); the
 * app's ladder is keyed by `RarityType`. `rarityTypeFromName` bridges the two
 * and the ladder does the rest: nothing below Rare has an entry, so a Common
 * perk gets a grey pip rather than a colour that says nothing.
 */
function accentForRarityName(name: string | null | undefined) {
  const type = rarityTypeFromName(name)

  return type ? accentByRarity[type] ?? null : null
}

const alterationWords: Record<string, string> = {
  afflicted: 'afflicted',
  afflictedenemy: 'afflicted enemies',
  critdmg: 'critical damage',
  critrating: 'critical rating',
  damage: 'damage',
  headshotdamage: 'headshot damage',
  knockbackaoe: 'area knockback',
  ranged: 'ranged',
  weapon: 'weapon',
}

/** Human fallback for alteration ids missing from the extracted name table. */
function alterationName(templateId: string) {
  const raw = (templateId.split(':').pop() ?? templateId)
    .replace(/^aid_[ag]_/, '')
    .replace(/_alt\d+$/i, '')
  const words = raw
    .split('_')
    .filter((word) => word !== 'att' && word !== 'ondmg')
    .map((word) => alterationWords[word.toLowerCase()] ?? word)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return words
    ? words.charAt(0).toUpperCase() + words.slice(1)
    : 'Unknown perk'
}

function displayAlteration(records: ItemRecordMap, templateId: string) {
  return getItemRecord(records, templateId)?.name ?? alterationName(templateId)
}

/**
 * Alteration loadouts list their scalable perks at Common (`_t01`). A respec
 * keeps the rarity of the perk already in the slot, so use that same tier for
 * both the label shown to the player and the alteration sent to the backend.
 */
function alterationAtCurrentTier(option: string, current: string) {
  const currentTier = current.match(/_t\d+$/i)?.[0]

  return currentTier && /_t\d+$/i.test(option)
    ? option.replace(/_t\d+$/i, currentTier)
    : option
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
  /** Survivors: the `WorkerPortrait:` id this copy rolled. */
  portrait?: string | null
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
    ? resolveItemArt(subject.templateId, records, subject.portrait)
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
                <span
                  className={cn(
                    'relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border-2',
                    art.accent
                      ? 'border-[color:var(--rarity)]'
                      : 'border-border/60'
                  )}
                  style={rarityStyle(art.accent)}
                >
                  {art.frame && (
                    <img decoding="async" loading="lazy"
                      alt=""
                      aria-hidden
                      className="absolute inset-0 size-full object-cover"
                      src={art.frame}
                    />
                  )}
                  <img decoding="async" loading="lazy"
                    alt=""
                    className="relative size-full object-contain"
                    src={art.largeImgUrl ?? art.imgUrl}
                  />
                </span>

                <div className="min-w-0 flex-1 text-left">
                  <DialogTitle className="text-left text-lg leading-tight">
                    {art.name}
                  </DialogTitle>
                  <p
                    className={cn(
                      'micro-label mt-1.5',
                      art.accent && 'text-[color:var(--rarity)]'
                    )}
                    style={rarityStyle(art.accent)}
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
                    <p className="mt-2 flex items-center gap-1.5 leading-none">
                      <Zap className="size-4 text-muted-foreground" />
                      <span className="figure text-base font-bold">
                        {power}
                      </span>
                      <span className="micro-label">Power</span>
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {typeof subject.level === 'number' && (
                      <span>
                        Level <span className="figure">{subject.level}</span>
                      </span>
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
              <Callout tone="warning">
                {subject.lockedReason === 'favorite'
                  ? 'Favourited in game — protected from recycling.'
                  : 'Assigned to a squad or hero loadout — protected from recycling.'}
              </Callout>
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

            {!subject.alterations &&
              record?.alterationRow &&
              (alterationPools?.[record.alterationRow]?.length ?? 0) > 0 && (
                <Section
                  icon={Sparkles}
                  title="Available perks"
                >
                  <ul className="space-y-1.5">
                    {alterationPools?.[record.alterationRow]?.map(
                      (slot, slotIndex) => (
                        <li
                          className="panel px-3 py-2"
                          key={`${record.alterationRow}-${slotIndex}`}
                        >
                          <p className="section-label mb-1.5">
                            Slot {slotIndex + 1}
                            {slot.requiredLevel > 0 &&
                              ` · unlocks at level ${slot.requiredLevel}`}
                          </p>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {[...new Set(slot.options.map((option) =>
                              displayAlteration(records, option)
                            ))].join(' · ')}
                          </p>
                        </li>
                      )
                    )}
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
                        className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 py-1 pl-1 pr-2.5 text-xs"
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
                <span className="flex items-center gap-2 text-sm">
                  <ItemIcon
                    records={records}
                    templateId={record.recycle.result}
                  />
                  <span className="figure font-semibold">
                    {record.recycle.amount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">
                    {getItemRecord(records, record.recycle.result)?.name ?? ''}
                  </span>
                </span>
              </Section>
            )}

            <p className="select-all break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-[0.625rem] text-muted-foreground ring-1 ring-inset ring-border/60">
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
        <p className="text-xs text-muted-foreground">
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
  const accent = accentForRarityName(perkRecord?.rarity)
  const upgrade = perkRecord?.upgradeCost ?? {}
  const options = (pool?.options ?? [])
    .map((option) => alterationAtCurrentTier(option, alteration))
    .filter((option) => option.toLowerCase() !== alteration.toLowerCase())

  return (
    <li className="panel px-3 py-2">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-1.5 size-1.5 shrink-0 rounded-full',
            accent ? 'bg-[color:var(--rarity)]' : 'bg-muted-foreground/50'
          )}
          style={rarityStyle(accent)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {displayAlteration(records, alteration)}
          </p>

          {Object.keys(upgrade).length > 0 && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Upgrade costs</span>
              {Object.entries(upgrade).map(([costId, amount]) => (
                <span
                  className="inline-flex items-center gap-1"
                  key={costId}
                >
                  <ItemIcon
                    records={records}
                    size="small"
                    templateId={costId}
                  />
                  <span className="figure">{amount.toLocaleString()}</span>
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
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>Each change costs</span>
              {Object.entries(pool?.respecCost ?? {}).map(
                ([costId, amount]) => (
                  <span
                    className="inline-flex items-center gap-1"
                    key={costId}
                  >
                    <ItemIcon
                      records={records}
                      size="small"
                      templateId={costId}
                    />
                    <span className="figure">{amount.toLocaleString()}</span>
                  </span>
                )
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <button
                className="rounded-lg border border-border/70 px-2 py-1 text-xs transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
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
                {displayAlteration(records, option)}
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
      <p className="section-label flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground" />
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
      <div className="panel px-3 py-2">
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
            className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 py-1 pl-1 pr-2.5 text-xs"
            key={templateId}
          >
            <ItemIcon
              records={records}
              size="small"
              templateId={templateId}
            />
            <span className="figure font-semibold">
              {amount.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              {getItemRecord(records, templateId)?.name ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
