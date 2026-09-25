import type {
  AlterationSlotPool,
  ItemRecordMap,
} from '../../kernel/core/item-database'
import type { ItemActionRequest } from '../../kernel/core/item-actions'
import type { RatingTables } from '../../config/constants/fortnite/power'

import {
  ArrowUp,
  ExternalLink,
  Recycle,
  RefreshCw,
  Sparkles,
  Star,
  Wrench,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { useState } from 'react'

import { Button } from '../ui/button'
import { evolutionOptions } from './evolution-options'

import { ItemIcon, resolveItemArt } from './item-icon'
import { Artboard, BadgeMark, itemBadgeMarks } from './artboard'
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
import { rarities, raritiesColor, RarityType } from '../../config/constants/resources'
import { pennyDBSchematicUrl } from '../../services/endpoints/pennydb'

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
   * is what marks a codex entry as read-only.
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
  /** A power the caller already knows, over the one read from the tables. */
  power?: number | null
}

/** What a screen knows about one rolled perk beyond its id. */
export type PerkDetail = {
  /** Beats the database name — legacy perks are often missing from it. */
  name?: string
  tags?: ReactNode
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
  badges,
  children,
  isBusy,
  onAction,
  onOpenChange,
  perkDetails,
  ratings,
  records,
  subject,
}: {
  alterationPools?: Record<string, Array<AlterationSlotPool>>
  /** Extra chips in the title strip, after the name. */
  badges?: ReactNode
  /** A screen's own findings, after everything the item itself says. */
  children?: ReactNode
  /** An action is in flight — every button waits. */
  isBusy?: boolean
  /**
   * Omit to render read-only. Provided, it enables levelling, evolving and
   * perk work on the owned copy.
   */
  onAction?: (request: ItemActionRequest) => void
  onOpenChange: (open: boolean) => void
  /** Lined up with `subject.alterations`. */
  perkDetails?: Array<PerkDetail | undefined>
  ratings?: RatingTables
  records: ItemRecordMap
  subject: ItemDetailSubject | null
}) {
  const record = subject ? getItemRecord(records, subject.templateId) : null
  const art = subject
    ? resolveItemArt(subject.templateId, records, subject.portrait)
    : null
  const power =
    typeof subject?.power === 'number'
      ? subject.power
      : subject && typeof subject.level === 'number'
        ? computeItemPower({
            level: subject.level,
            tables: ratings,
            templateId: subject.templateId,
          })
        : null
  const tier = subject ? (subject.tier ?? record?.tier ?? 0) : 0
  /**
   * A codex entry has no copy and so no level — what it can reach is the
   * useful number instead: its power at the level cap of the tier shown.
   */
  const maxLevel = subject && power === null && typeof subject.level !== 'number'
    ? levelCapForTier(tier)
    : null
  const maxPower =
    subject && maxLevel !== null
      ? computeItemPower({
          level: maxLevel,
          tables: ratings,
          templateId: subject.templateId,
        })
      : null
  const metaLine = [record?.subType, record?.displayTier]
    .filter(Boolean)
    .join(' · ')
  const rarityColor = art
    ? (raritiesColor[art.rarity as RarityType] ?? raritiesColor[RarityType.Common])
    : raritiesColor[RarityType.Common]
  const marks = subject
    ? itemBadgeMarks({
        personality: subject.personality,
        record,
        setBonus: subject.setBonus,
        templateId: subject.templateId,
      })
    : []

  return (
    <Dialog
      onOpenChange={onOpenChange}
      open={subject !== null}
    >
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
        {subject && art && (
          <>
            {/* Title strip: rarity pill and name, as the site heads it. */}
            <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border/60 px-5 py-3.5 pr-12 text-left">
              <span
                className="shrink-0 rounded-full border px-2.5 py-0.5 text-2xs font-bold uppercase tracking-wider"
                style={{
                  background: `color-mix(in srgb, ${rarityColor} 18%, transparent)`,
                  borderColor: `color-mix(in srgb, ${rarityColor} 70%, transparent)`,
                  color: rarityColor,
                }}
              >
                {record?.rarity ?? rarities[art.rarity as RarityType] ?? 'Item'}
              </span>
              <DialogTitle className="truncate text-left text-title font-bold uppercase tracking-wide">
                {art.name}
              </DialogTitle>
              {badges && <span className="flex shrink-0 flex-wrap gap-1.5">{badges}</span>}
            </DialogHeader>

            {/* Power and tier stars — dropped when there is neither. */}
            {(power !== null || tier > 0 || metaLine) && (
              <div className="flex items-center gap-4 border-b border-border/60 px-5 py-2.5">
                {power !== null && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Zap className="size-4" />
                    <span className="figure text-base font-bold">{power}</span>
                  </span>
                )}
                {tier > 0 && (
                  <span aria-label={`Tier ${tier}`} className="flex gap-0.5 text-primary" role="img">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        className={cn('size-3.5', index < tier ? 'fill-current' : 'opacity-25')}
                        key={index}
                      />
                    ))}
                  </span>
                )}
                <span className="ml-auto truncate text-xs font-semibold text-muted-foreground">
                  {metaLine}
                </span>
              </div>
            )}

            <div className="grid gap-5 p-5 md:grid-cols-[17rem_minmax(0,1fr)]">
              {/* Left: the art and its facts. */}
              <div className="space-y-2.5">
                <Artboard
                  className="aspect-square w-full rounded-xl"
                  rarity={art.rarity}
                  style={{ boxShadow: `inset 0 0 0 2px ${rarityColor}` }}
                >
                  {(art.largeImgUrl ?? art.imgUrl) && (
                    <img
                      alt=""
                      className={cn(
                        'absolute inset-0 size-full drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]',
                        subject.templateId.startsWith('Hero:') ? 'object-cover object-top' : 'object-contain p-3'
                      )}
                      decoding="async"
                      src={art.largeImgUrl ?? art.imgUrl}
                    />
                  )}
                  {marks.length > 0 && (
                    <span className="absolute left-2 top-2 flex flex-col gap-1">
                      {marks.map((entry) => (
                        <BadgeMark className="size-6" key={entry.src} mark={entry} />
                      ))}
                    </span>
                  )}
                </Artboard>

                {power !== null && (
                  <FactBlock label="Power level">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Zap className="size-4" />
                      <span className="figure">{power}</span>
                    </span>
                  </FactBlock>
                )}
                {maxPower !== null && (
                  <FactBlock label={`Power at level ${maxLevel}`}>
                    <span className="flex items-center gap-1.5 text-primary">
                      <Zap className="size-4" />
                      <span className="figure">{maxPower}</span>
                    </span>
                  </FactBlock>
                )}
                <FactBlock color={rarityColor} label="Rarity" tinted>
                  <span className="uppercase" style={{ color: rarityColor }}>
                    {record?.rarity ?? rarities[art.rarity as RarityType] ?? 'Unknown'}
                  </span>
                </FactBlock>
                {(typeof subject.level === 'number' || subject.personality || subject.setBonus) && (
                  <FactBlock label={typeof subject.level === 'number' ? 'Level' : 'Traits'}>
                    <span className="flex flex-wrap items-baseline gap-x-3">
                      {typeof subject.level === 'number' && <span className="figure">{subject.level}</span>}
                      {subject.personality && (
                        <span className="text-xs font-medium text-muted-foreground">{subject.personality}</span>
                      )}
                      {subject.setBonus && (
                        <span className="text-xs font-medium text-muted-foreground">{subject.setBonus}</span>
                      )}
                    </span>
                  </FactBlock>
                )}
                {subject.lockedReason && (
                  <Callout tone="warning">
                    {subject.lockedReason === 'favorite'
                      ? 'Favourited in game — protected from recycling.'
                      : 'Assigned to a squad or hero loadout — protected from recycling.'}
                  </Callout>
                )}
              </div>

              {/* Right: what the item does, and what you can do to it. */}
              <div className="min-w-0 space-y-4">
            {record?.description ? (
              <div className="border-l-2 border-primary/60 pl-3">
                <p className="section-label mb-1">Description</p>
                <DialogDescription className="whitespace-pre-line text-left text-ui italic leading-relaxed">
                  {record.description}
                </DialogDescription>
              </div>
            ) : (
              <DialogDescription className="sr-only">{art.name}</DialogDescription>
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
                      detail={perkDetails?.[index]}
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

            {record && (record.abilities?.length ?? 0) > 0 && (
              <Section
                icon={Sparkles}
                title="Abilities"
              >
                <ul className="flex flex-wrap gap-2">
                  {record.abilities?.map((ability) => {
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

            {record && Object.keys(record.craftingCost ?? {}).length > 0 && (
              <CostSection
                icon={Wrench}
                cost={record.craftingCost}
                records={records}
                title="Crafting cost"
              />
            )}

            {record && Object.keys(record.tierUpCost ?? {}).length > 0 && (
              <CostSection
                icon={Star}
                cost={record.tierUpCost}
                records={records}
                title="Next tier costs"
              />
            )}

            {record?.recycle && record.recycle.amount > 0 && (
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

            {children}

            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 select-all break-all rounded-lg bg-muted/40 px-3 py-2 font-mono text-2xs text-muted-foreground ring-1 ring-inset ring-border/60">
                {subject.templateId}
              </p>
              {subject.templateId.startsWith('Schematic:') && (
                <Button
                  onClick={() => window.electronAPI.openExternalURL(pennyDBSchematicUrl(art.name))}
                  size="sm"
                  title="Every variant of this schematic on PennyDB"
                  variant="secondary"
                >
                  <ExternalLink className="size-3.5" />
                  View on PennyDB
                </Button>
              )}
            </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * One fact under the art, as the site stacks them: a label over a figure,
 * a bar down the left in the accent — or, for rarity, a wash in its colour.
 */
function FactBlock({
  children,
  color,
  label,
  tinted,
}: {
  children: ReactNode
  color?: string
  label: string
  tinted?: boolean
}) {
  return (
    <div
      className="rounded-md border-l-[3px] border-primary/70 bg-muted/40 px-3 py-2"
      style={
        color
          ? {
              background: tinted ? `color-mix(in srgb, ${color} 22%, transparent)` : undefined,
              borderLeftColor: color,
            }
          : undefined
      }
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-lg font-bold leading-snug">{children}</div>
    </div>
  )
}

/** Lowercase roman numerals — what `UpgradeItemBulk` wants for a tier. */
const romanTiers = ['i', 'ii', 'iii', 'iv', 'v']

/**
 * Tier N caps levelling at N×10. A maxed tier-5 item — the "130" its power
 * level reads as — keeps going to 60, but each level past 50 spends a
 * supercharger from Ventures instead of manuals, so that stays one press
 * per level and is never folded into a bulk jump.
 */
export const superchargeMaxLevel = 60

export function levelCapForTier(tier: number) {
  return tier > 0 ? Math.min(tier, 5) * 10 : null
}

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
  const level = subject.level ?? 1
  const cap = levelCapForTier(tier)
  const supercharging = tier >= 5 && level >= 50
  /*
   * At its tier cap an item cannot take another level — Epic rejects the
   * `UpgradeItem` as "in an overflow state" — so the only way on is to
   * evolve. Only past tier 5 does levelling continue, as supercharging.
   */
  const atTierCap = cap !== null && !supercharging && level >= cap
  const canLevel = supercharging
    ? level < superchargeMaxLevel
    : !atTierCap
  const bulkTarget =
    cap !== null && !supercharging ? Math.min(level + 10, cap) : null
  const canBulkLevel = bulkTarget !== null && bulkTarget - level >= 2
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
        {canLevel && (
          <Button
            disabled={isBusy}
            onClick={() =>
              act('level', { kind: 'level', itemId: subject.itemId as string })
            }
            size="sm"
            variant={confirming === 'level' ? 'destructive' : 'secondary'}
          >
            {supercharging ? (
              <Zap className="size-3.5" />
            ) : (
              <ArrowUp className="size-3.5" />
            )}
            {label('level', supercharging ? 'Supercharge +1' : 'Level +1')}
          </Button>
        )}

        {canBulkLevel && (
          <Button
            disabled={isBusy}
            onClick={() =>
              act('bulk-level', {
                kind: 'level',
                itemId: subject.itemId as string,
                desiredLevel: bulkTarget as number,
              })
            }
            size="sm"
            variant={confirming === 'bulk-level' ? 'destructive' : 'secondary'}
          >
            <ArrowUp className="size-3.5" />
            {label(
              'bulk-level',
              bulkTarget === cap
                ? `Level to ${bulkTarget} (tier max)`
                : `Level +${(bulkTarget as number) - level}`
            )}
          </Button>
        )}

        {canEvolve && evolutionOptions(record, tier).map((option) => (
          <Button
            key={option.conversionIndex}
            disabled={isBusy}
            onClick={() =>
              act(`evolve-${option.conversionIndex}`, {
                kind: 'evolve',
                itemId: subject.itemId as string,
                desiredLevel: subject.level ?? 1,
                desiredTier: romanTiers[tier] ?? 'no_tier',
                conversionIndex: option.conversionIndex,
              })
            }
            size="sm"
            variant={confirming === `evolve-${option.conversionIndex}` ? 'destructive' : 'secondary'}
          >
            <Star className="size-3.5" />
            {label(`evolve-${option.conversionIndex}`, option.label)}
          </Button>
        ))}

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

      {atTierCap && canEvolve && (
        <p className="text-xs text-muted-foreground">
          Level {cap} is the most tier {tier} allows. Evolve it to keep
          levelling.
        </p>
      )}

      {!canLevel && !canEvolve && !canUpgradeRarity && (
        <p className="text-xs text-muted-foreground">
          Fully supercharged — nothing left to upgrade.
        </p>
      )}

      {supercharging && level < superchargeMaxLevel && (
        <p className="text-xs text-muted-foreground">
          Past level 50 — each level now spends a supercharger from Ventures.
        </p>
      )}

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
/** Perk rarities, lowest first — how far a perk has been upgraded. */
const perkRanks = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function PerkRow({
  alteration,
  detail,
  isBusy,
  onAction,
  pool,
  records,
  slotIndex,
  subject,
}: {
  alteration: string
  detail?: PerkDetail
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

  const rank = perkRanks.indexOf((perkRecord?.rarity ?? '').toLowerCase()) + 1
  const edge = accent ?? 'hsl(var(--muted-foreground) / 0.5)'

  return (
    <li
      className="panel border-l-[3px] px-3 py-2"
      style={{ ...rarityStyle(accent), borderLeftColor: edge }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-ui font-semibold">
            {detail?.name ?? displayAlteration(records, alteration)}
          </p>
          {detail?.tags && (
            <span className="mt-1 flex flex-wrap gap-1">{detail.tags}</span>
          )}
          {/* The site's rarity pips: one lit per step the perk has climbed. */}
          {rank > 0 && (
            <span aria-label={`${perkRecord?.rarity} perk`} className="mt-1.5 flex gap-1" role="img">
              {perkRanks.map((name, index) => (
                <span
                  className="h-0.5 flex-1 rounded-full"
                  key={name}
                  style={{
                    background: index < rank ? edge : 'hsl(var(--muted-foreground) / 0.2)',
                  }}
                />
              ))}
            </span>
          )}

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
        <p className="text-ui font-semibold">{perk.name}</p>
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
