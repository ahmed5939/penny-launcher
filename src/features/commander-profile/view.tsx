import type { ItemRecordMap } from '../../kernel/core/item-database'
import type { RatingTables } from '../../config/constants/fortnite/power'
import type { ProfileEntry, ProfileFort, ProfileHero, ProfileStack } from './model'

import { ExternalLink, UserRound, Zap } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { Button } from '../../components/ui/button'
import {
  AccountResourceGate,
  AnimatedNumber,
  Callout,
  EmptyState,
  KeyValue,
  ListRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  RefreshButton,
  StatRow,
  StatTile,
  ToolBadges,
} from '../../components/page'
import { Artboard, BadgeMark, badgeUrl, itemBadgeMarks } from '../../components/items/artboard'
import { ItemIcon, itemBadge, resolveItemArt } from '../../components/items/item-icon'

import { useProfileResource } from './load'
import { setBonusRules } from './model'

import { getItemRecord, useItemDatabaseStore } from '../../state/items/database'
import { useRequestItemDatabase } from '../../bootstrap/components/load-item-database'

import { computeItemPower } from '../../config/constants/fortnite/power'
import { fortStats } from '../../config/constants/fortnite/fort'
import { pennyDBProfileUrl } from '../../services/endpoints/pennydb'

import { cn } from '../../lib/utils'

export function CommanderProfilePage() {
  const resource = useProfileResource()
  const displayName = resource.data?.displayName

  return (
    <>
      <PageHeader
        actions={
          <>
            {displayName && (
              <Button
                onClick={() => window.electronAPI.openExternalURL(pennyDBProfileUrl(displayName))}
                title="The same profile on the Penny database site"
                variant="secondary"
              >
                <ExternalLink className="size-3.5" />
                Open on PennyDB
              </Button>
            )}
            <RefreshButton disabled={!resource.accountId} loading={resource.loading} onClick={resource.refresh} />
          </>
        }
        description="Your commander at a glance — levels, F.O.R.T., squads and stockpile."
        icon={UserRound}
        section="Save the World"
        status={<ToolBadges readOnly />}
        title="Profile"
      />
      <AccountResourceGate
        icon={UserRound}
        loading={{ title: 'Loading the profile…', description: 'Reading the campaign profile from Epic.' }}
        resource={resource}
        what="the profile"
      >
        {(entry) => <Profile entry={entry} key={entry.accountId} />}
      </AccountResourceGate>
    </>
  )
}

function Profile({ entry }: { entry: ProfileEntry }) {
  useRequestItemDatabase()
  const records = useItemDatabaseStore((state) => state.records)
  const ratings = useItemDatabaseStore((state) => state.ratings)
  const pending = entry.pending.missionAlertRewards + entry.pending.difficultyIncreaseRewards
  const unopened = entry.llamas.reduce((sum, llama) => sum + llama.quantity, 0)

  return (
    <>
      <CommanderBanner entry={entry} ratings={ratings} records={records} />

      {pending > 0 && (
        <Callout tone="warning" title={`${pending} reward${pending === 1 ? '' : 's'} waiting to be claimed`}>
          Mission alert and difficulty rewards are held on the account until you next play.
        </Callout>
      )}

      <StatRow>
        <StatTile
          hint={entry.postMaxLevels > 0 ? `+${entry.postMaxLevels.toLocaleString()} past the cap` : `${entry.matchesPlayed.toLocaleString()} matches played`}
          label="Commander level"
          value={entry.commanderLevel.toLocaleString()}
        />
        <StatTile
          hint={`${entry.daysLoggedIn.toLocaleString()} days logged in`}
          label="Collection Book level"
          value={entry.collectionBookLevel.toLocaleString()}
        />
        <StatTile
          hint={entry.ventures?.xp != null ? `${entry.ventures.xp.toLocaleString()} season XP` : 'No venture this season'}
          label="Ventures zones"
          value={entry.ventures?.zonesUnlocked != null ? `${entry.ventures.zonesUnlocked} / ${entry.ventures.zones}` : 'Unavailable'}
        />
        <StatTile
          hint={`${entry.llamas.length} ${entry.llamas.length === 1 ? 'type' : 'types'}`}
          label="Unopened llamas"
          value={unopened.toLocaleString()}
        />
      </StatRow>

      <FortPanel fort={entry.fort} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader as="div" compact title="Survivor set bonuses" />
          <PanelBody>
            <ul>
              {Object.keys(setBonusRules).map((name) => {
                const bonus = entry.setBonuses.find((candidate) => candidate.name === name)

                return (
                  <ListRow
                    caption={bonus && bonus.active > 0 ? `×${bonus.active} active` : undefined}
                    className={bonus?.active ? undefined : 'opacity-60'}
                    figure={`+${bonus?.totalPct ?? 0}%`}
                    key={name}
                    name={name}
                    well={<BonusIcon name={name} />}
                  />
                )
              })}
            </ul>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader as="div" compact title="Squads" />
          <PanelBody>
            <ul>
              {entry.squads.map((squad) => {
                const src = badgeUrl(squadEmblem[squad.id] ?? '')
                const lead = squad.leadMatches ? 'Lead job matches' : squad.filled > 0 ? 'Lead job does not match' : 'No lead'
                const personalities = squad.filled > 1 ? ` · ${squad.personalityMatches}/${squad.filled - 1} personalities match` : ''

                return (
                  <ListRow
                    caption={`${lead}${personalities}`}
                    figure={`${squad.filled}/8`}
                    key={squad.id}
                    name={squad.label}
                    well={src ? <img alt="" className="size-7 shrink-0 object-contain" src={src} /> : <span className="size-7 shrink-0" />}
                  />
                )
              })}
            </ul>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Shelf items={entry.resources} records={records} title="Resources" />
        <Shelf items={entry.llamas} records={records} title="Llamas" />
      </div>
    </>
  )
}

function heroPower(hero: ProfileHero, ratings: RatingTables) {
  return computeItemPower({ level: hero.level, tables: ratings, templateId: hero.templateId })
}

function CommanderBanner({
  entry,
  ratings,
  records,
}: {
  entry: ProfileEntry
  ratings: RatingTables
  records: ItemRecordMap
}) {
  const commander = entry.commander
  const art = commander ? resolveItemArt(commander.templateId, records) : null
  const mark = commander ? itemBadgeMarks({ record: getItemRecord(records, commander.templateId), templateId: commander.templateId })[0] : null

  return (
    <Panel className="relative flex items-stretch gap-5 overflow-hidden p-5">
      <AccountAvatar
        accountId={entry.accountId}
        className="self-center ring-2 ring-primary/60"
        name={entry.displayName}
        size="xl"
      />

      <div className="min-w-0 flex-1 self-center">
        <p className="micro-label">Commander profile</p>
        <p className="mt-0.5 truncate text-display-lg font-bold leading-tight tracking-tight">{entry.displayName}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.counts.survivors.toLocaleString()} survivors · {entry.counts.heroes.toLocaleString()} heroes ·{' '}
          {entry.counts.defenders.toLocaleString()} defenders · {entry.counts.schematics.toLocaleString()} schematics
        </p>
        <KeyValue className="mt-3 max-w-md" copyable label="Account ID" value={entry.accountId} />
      </div>

      <div
        className="flex shrink-0 flex-col items-end justify-center text-right"
        title={
          entry.power?.approximate
            ? 'Survivor squads plus research. Research is part-way, so its share is approximate.'
            : 'Survivor squads plus research, rated the way PennyDB rates it.'
        }
      >
        <span className="micro-label">Power</span>
        <span className="figure text-display-lg font-bold leading-none text-primary">
          {entry.power ? (
            <>
              {entry.power.approximate && '≈ '}
              <AnimatedNumber format={(n) => n.toFixed(2)} value={entry.power.value} />
            </>
          ) : (
            'Unavailable'
          )}
        </span>
        {entry.support.length > 0 && (
          <span className="mt-2 flex gap-1" aria-label="Support team">
            {entry.support.map((hero, index) => {
              const heroArt = resolveItemArt(hero.templateId, records)
              const power = heroPower(hero, ratings)

              return (
                <Artboard className="size-9 rounded" key={index} rarity={heroArt.rarity}>
                  {heroArt.imgUrl && (
                    <img alt="" className="absolute inset-0 size-full object-cover object-top" decoding="async" src={heroArt.imgUrl} title={heroArt.name} />
                  )}
                  {power ? <span className={cn(itemBadge, 'figure bottom-0 right-0 rounded px-0.5 text-3xs')}>{power}</span> : null}
                </Artboard>
              )
            })}
          </span>
        )}
      </div>

      {commander && art && (
        <Artboard className="hidden w-40 shrink-0 rounded-xl lg:block" rarity={art.rarity}>
          {art.imgUrl && (
            <img alt={art.name} className="absolute inset-0 size-full object-cover object-top" decoding="async" src={art.largeImgUrl ?? art.imgUrl} />
          )}
          {mark && <BadgeMark className="absolute left-1.5 top-1.5" mark={mark} />}
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6 text-center">
            <span className="block truncate text-caption font-semibold text-white">{art.name}</span>
            <span className="block text-2xs font-semibold text-white/75">
              Commander{heroPower(commander, ratings) ? <> · <span className="figure">{heroPower(commander, ratings)}</span></> : null}
            </span>
          </span>
        </Artboard>
      )}
    </Panel>
  )
}

/** The four F.O.R.T. stats as the game stores them: a coloured bar each. */
function FortPanel({ fort }: { fort: ProfileFort | null }) {
  const top = fort ? Math.max(1, ...fortStats.map((stat) => fort[stat.key])) : 1

  return (
    <Panel>
      <PanelHeader as="div" compact title="F.O.R.T. stats" />
      <PanelBody>
        <StatRow>
          {fortStats.map((stat) => (
            <StatTile accent={stat.color} key={stat.key} label={stat.label} value={fort ? fort[stat.key].toLocaleString() : '—'}>
              <ProgressBar className="mt-2 bg-background/70" color={stat.color} label={stat.label} total={top} value={fort?.[stat.key] ?? 0} />
            </StatTile>
          ))}
        </StatRow>
      </PanelBody>
    </Panel>
  )
}

const bonusFiles: Record<string, string> = {
  'Ability Damage': 'survivors-ability_damage',
  Health: 'survivors-health',
  'Melee Damage': 'survivors-melee_weapon_damage',
  'Ranged Damage': 'survivors-ranged_weapon_damage',
  Shield: 'survivors-shield',
  'Shield Regeneration': 'survivors-shield_regeneration',
  'Trap Damage': 'survivors-trap_damage',
  'Trap Durability': 'survivors-trap_durability',
}

function BonusIcon({ name }: { name: string }) {
  const src = badgeUrl(bonusFiles[name] ?? '')

  return (
    <span className="grid size-7 shrink-0 place-items-center">
      {src ? <img alt="" className="size-7 object-contain" src={src} /> : <Zap className="size-4 text-muted-foreground" />}
    </span>
  )
}

const squadEmblem: Record<string, string> = {
  Squad_Attribute_Arms_CloseAssaultSquad: 'squads-close_assault_squad',
  Squad_Attribute_Arms_FireTeamAlpha: 'squads-fire_team_alpha_squad',
  Squad_Attribute_Medicine_EMTSquad: 'squads-emt_squad',
  Squad_Attribute_Medicine_TrainingTeam: 'squads-training_team_squad',
  Squad_Attribute_Scavenging_Gadgeteers: 'squads-gadgeteers_squad',
  Squad_Attribute_Scavenging_ScoutingParty: 'squads-scouting_party_squad',
  Squad_Attribute_Synthesis_CorpsofEngineering: 'squads-engineering_squad',
  Squad_Attribute_Synthesis_TheThinkTank: 'squads-think_tank_squad',
}

function Shelf({ items, records, title }: { items: Array<ProfileStack>; records: ItemRecordMap; title: string }) {
  return (
    <Panel>
      <PanelHeader as="div" compact title={title} />
      <PanelBody>
        {items.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-6">
            {items.map((item) => (
              <ListRow
                figure={compact(item.quantity)}
                key={item.templateId}
                name={resolveItemArt(item.templateId, records).name}
                well={<ItemIcon records={records} templateId={item.templateId} />}
              />
            ))}
          </ul>
        ) : (
          <EmptyState className="border-0 bg-transparent py-8" title="Nothing here" />
        )}
      </PanelBody>
    </Panel>
  )
}

function compact(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '')}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1e4) return `${(value / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return value.toLocaleString()
}
