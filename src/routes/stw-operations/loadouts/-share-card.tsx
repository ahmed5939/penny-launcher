import type { CSSProperties, ReactNode } from 'react'
import type { ItemRecordMap } from '../../../kernel/core/item-database'
import type { LoadoutEntry, LoadoutMember } from '../../../kernel/core/loadouts'
import type { RatingTables } from '../../../config/constants/fortnite/power'

import { BadgeMark, itemBadgeMarks } from '../../../components/items/artboard'
import { resolveItemArt } from '../../../components/items/item-icon'

import { getItemRecord } from '../../../state/items/database'

import { computeItemPower } from '../../../config/constants/fortnite/power'
import { rarities, raritiesColor, RarityType } from '../../../config/constants/resources'
import { shareCardPalette as palette } from '../../../config/constants/share-card'

/**
 * A loadout the way the game's own loadout screen draws it, for sharing: a
 * slanted section heading over each band, the commander on a banner in its
 * rarity with power, stars, abilities and the commander perk, the team perk
 * on a glowing bar, then a row per support hero, gadget and defender — perk
 * icon, perk name, portrait. Rendered off-screen only while an image is
 * being made; the launcher's own card stays the launcher's.
 */
export function LoadoutShareCard({
  loadout,
  ratings,
  records,
  sharedBy,
  title,
}: {
  loadout: LoadoutEntry
  ratings: RatingTables
  records: ItemRecordMap
  sharedBy?: string
  title: string
}) {
  const commander = loadout.commander?.templateId ? loadout.commander : null
  const teamPerk = loadout.teamPerk ? getItemRecord(records, loadout.teamPerk) : null
  const defenders = loadout.defenders.filter((defender) => defender.templateId)

  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${palette.backdropTop}, ${palette.backdropBottom})`,
        color: palette.text,
        fontFamily: 'inherit',
        padding: 20,
        width: 560,
      }}
    >
      <div style={{ alignItems: 'baseline', display: 'flex', gap: 16, justifyContent: 'space-between', marginBottom: 6 }}>
        <Heading>Commander</Heading>
        <span style={{ color: palette.muted, flexShrink: 0, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {title}
          {loadout.active ? ' · Equipped' : ''}
        </span>
      </div>

      {commander ? (
        <CommanderBanner member={commander} ratings={ratings} records={records} />
      ) : (
        <Row icon={null} label="No commander" records={records} />
      )}

      <Heading>Team perk</Heading>
      <div
        style={{
          alignItems: 'center',
          background: `linear-gradient(90deg, ${palette.perkFrom}, ${palette.perkTo})`,
          boxShadow: `0 0 18px color-mix(in srgb, ${palette.perkTo} 45%, transparent)`,
          display: 'flex',
          gap: 12,
          height: 52,
          paddingRight: 16,
        }}
      >
        <IconWell records={records} templateId={loadout.teamPerk} />
        <Label>{teamPerk?.name ?? 'No team perk'}</Label>
      </div>

      <Heading>Support team</Heading>
      <div style={{ display: 'grid', gap: 6 }}>
        {loadout.team.map((member) => {
          const record = member.templateId ? getItemRecord(records, member.templateId) : null

          return (
            <Row
              icon={record?.perkTemplate ?? null}
              key={member.slot}
              label={record?.perk?.name ?? (member.templateId ? record?.name ?? 'Hero' : 'Empty')}
              member={member.templateId ? member : null}
              ratings={ratings}
              records={records}
            />
          )
        })}
      </div>

      <Heading>Gadgets</Heading>
      <div style={{ display: 'grid', gap: 6 }}>
        {loadout.gadgets.map((gadget, index) => (
          <Row
            icon={gadget}
            key={index}
            label={gadget ? (getItemRecord(records, gadget)?.name ?? gadget.split(':').pop() ?? '') : 'Empty'}
            records={records}
          />
        ))}
      </div>

      {defenders.length > 0 && (
        <>
          <Heading>Defenders</Heading>
          <div style={{ display: 'grid', gap: 6 }}>
            {defenders.map((defender) => (
              <Row
                icon={defender.schematicTemplateId}
                key={defender.slot}
                label={`${(getItemRecord(records, defender.templateId as string)?.name ?? 'Defender').replace(/^(Common|Uncommon|Rare|Epic|Legendary|Mythic)\s+/i, '')} · ${
                  defender.schematicTemplateId ? (getItemRecord(records, defender.schematicTemplateId)?.name ?? 'Weapon') : 'Default weapon'
                }`}
                member={defender}
                ratings={ratings}
                records={records}
              />
            ))}
          </div>
        </>
      )}

      <div style={{ color: palette.muted, display: 'flex', fontSize: 11, gap: 16, justifyContent: 'space-between', marginTop: 16 }}>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sharedBy ?? ''}</span>
        <span style={{ flexShrink: 0, fontWeight: 700 }}>Penny</span>
      </div>
    </div>
  )
}

/** The game's section heading: pale blue, slanted, uppercase. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        color: palette.heading,
        fontSize: 15,
        fontStyle: 'italic',
        fontWeight: 800,
        letterSpacing: '0.02em',
        margin: '14px 0 6px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </p>
  )
}

function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span
      style={{
        flex: 1,
        fontSize: 14,
        fontWeight: 800,
        letterSpacing: '0.01em',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

/** A square icon well, the game's row start. */
function IconWell({ records, templateId }: { records: ItemRecordMap; templateId: string | null }) {
  const art = templateId ? resolveItemArt(templateId, records) : null

  return (
    <span
      style={{
        alignItems: 'center',
        background: palette.well,
        display: 'flex',
        flexShrink: 0,
        height: 52,
        justifyContent: 'center',
        width: 52,
      }}
    >
      {art?.imgUrl && <img alt="" src={art.imgUrl} style={{ height: 38, objectFit: 'contain', width: 38 }} />}
    </span>
  )
}

function heroPower(member: LoadoutMember, ratings: RatingTables) {
  return member.templateId ? computeItemPower({ level: member.level, tables: ratings, templateId: member.templateId }) : null
}

/** The hero's class mark, beside the portrait rather than on it. */
function ClassMark({ member, records }: { member: LoadoutMember; records: ItemRecordMap }) {
  const mark = itemBadgeMarks({ record: getItemRecord(records, member.templateId as string), templateId: member.templateId as string })[0]

  return mark ? <BadgeMark className="size-6 shrink-0" mark={mark} /> : null
}

/** A hero's portrait on a slanted rarity plate. */
function Portrait({ member, records }: { member: LoadoutMember; records: ItemRecordMap }) {
  const art = resolveItemArt(member.templateId as string, records)
  const color = raritiesColor[art.rarity as RarityType] ?? raritiesColor[RarityType.Common]

  return (
    <span style={{ alignSelf: 'stretch', display: 'flex', flexShrink: 0, position: 'relative', width: 96 }}>
      <span
        style={{
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} 55%, black), ${color})`,
          clipPath: 'polygon(14px 0, 100% 0, 100% 100%, 0 100%)',
          inset: 0,
          position: 'absolute',
        }}
      />
      {art.imgUrl && (
        <img
          alt=""
          src={art.imgUrl}
          style={{ bottom: 0, height: '100%', objectFit: 'cover', objectPosition: 'top', position: 'absolute', right: 0, width: 72 }}
        />
      )}
    </span>
  )
}

function Row({
  icon,
  label,
  member,
  ratings,
  records,
}: {
  icon: string | null
  label: string
  member?: LoadoutMember | null
  ratings?: RatingTables
  records: ItemRecordMap
}) {
  const power = member && ratings ? heroPower(member, ratings) : null

  return (
    <div style={{ alignItems: 'center', background: palette.row, display: 'flex', gap: 12, height: 52, overflow: 'hidden' }}>
      <IconWell records={records} templateId={icon} />
      <Label>{label}</Label>
      {power ? <span style={{ color: palette.muted, flexShrink: 0, fontSize: 12, fontWeight: 700 }}>{power}</span> : null}
      {member?.templateId ? <ClassMark member={member} records={records} /> : null}
      {member?.templateId ? <Portrait member={member} records={records} /> : <span style={{ width: 8 }} />}
    </div>
  )
}

function CommanderBanner({ member, ratings, records }: { member: LoadoutMember; ratings: RatingTables; records: ItemRecordMap }) {
  const record = getItemRecord(records, member.templateId as string)
  const art = resolveItemArt(member.templateId as string, records)
  const rarity = art.rarity as RarityType
  const color = raritiesColor[rarity] ?? raritiesColor[RarityType.Common]
  const perk = record?.commanderPerk ?? record?.perk ?? null
  const power = heroPower(member, ratings)
  const stars = Math.min(5, member.tier || 0)

  return (
    <div style={{ border: `3px solid ${palette.keyline}`, overflow: 'hidden' }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, black))`,
          padding: '10px 14px 10px 10px',
          position: 'relative',
        }}
      >
        <div style={{ alignItems: 'flex-start', display: 'flex', gap: 12 }}>
          {power ? (
            <span
              style={{
                background: 'rgb(255 255 255 / 0.28)',
                clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
                fontSize: 22,
                fontWeight: 900,
                padding: '2px 16px 2px 10px',
              }}
            >
              {power}
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', textAlign: 'right' }}>
            <p style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1, textTransform: 'uppercase' }}>{art.name}</p>
            <p style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              <span style={{ letterSpacing: 2, marginRight: 10 }}>{'★'.repeat(stars)}</span>
              {rarities[rarity] ?? ''} | {record?.subType ?? 'Hero'}
            </p>
          </div>
        </div>

        {record && record.abilities.length > 0 && (
          <div style={{ alignItems: 'center', display: 'flex', gap: 10, marginTop: 10 }}>
            <span style={{ color: 'rgb(255 255 255 / 0.55)', flex: 1, fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>
              Hero abilities
            </span>
            {record.abilities.slice(0, 3).map((ability) => {
              const abilityArt = resolveItemArt(ability, records)

              return abilityArt.imgUrl ? (
                <img alt="" key={ability} src={abilityArt.imgUrl} style={{ borderRadius: 999, height: 36, width: 36 }} />
              ) : null
            })}
          </div>
        )}
      </div>

      <div style={{ alignItems: 'center', background: palette.row, display: 'flex', gap: 12, height: 64, overflow: 'hidden' }}>
        <IconWell records={records} templateId={record?.commanderPerkTemplate ?? record?.perkTemplate ?? null} />
        <Label>{perk?.name ?? 'No commander perk'}</Label>
        <ClassMark member={member} records={records} />
        <Portrait member={member} records={records} />
      </div>
    </div>
  )
}
