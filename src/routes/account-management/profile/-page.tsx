import type {
  ProfileEntry,
  ProfileHeroLoadout,
  ProfileResource,
} from '../../../kernel/core/account-health'

import { UpdateIcon } from '@radix-ui/react-icons'
import { ExternalLink, HeartPulse } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../../components/ui/tabs'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
} from '../../../components/page'

import { useAccountHealthData } from './-hooks'

import { useGetAccounts } from '../../../hooks/accounts'

import { pennyDBProfileUrl } from '../../../services/endpoints/pennydb'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={HeartPulse}
        section={t('account-management.title')}
        title={t('account-management.options.profile')}
        description="Power, F.O.R.T., loadouts, resources and collection — enriched with PennyDB."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    data,
    handleGetInfo,
    isDisabledForm,
    isLoading,
  } = useAccountHealthData()

  return (
    <>
      {/* The account question is answered by the titlebar picker. */}
      <div className="flex items-center border-b border-border/60 pb-3">
        <Button
          className="ml-auto min-w-40"
          onClick={handleGetInfo}
          disabled={isDisabledForm}
        >
          {isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            'Load profiles'
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {data.length === 0 && !isLoading ? (
          <EmptyState
            icon={HeartPulse}
            title={
              isDisabledForm
                ? 'Select an account to load its profile'
                : 'No profile loaded'
            }
            description={
              isDisabledForm
                ? 'Pick an account in the titlebar, then load power, F.O.R.T. and collection from Epic.'
                : 'Load profiles to see power, F.O.R.T., loadouts and collection for the accounts in scope.'
            }
          />
        ) : (
          data.map((entry) => (
            <ProfileCard
              entry={entry}
              key={entry.accountId}
            />
          ))
        )}
      </div>

      <GoToTop containerId="selector-card" />
    </>
  )
}

const fortLabels = [
  ['Fortitude', 'fortitude'],
  ['Offense', 'offense'],
  ['Resistance', 'resistance'],
  ['Tech', 'technology'],
] as const

function ProfileCard({ entry }: { entry: ProfileEntry }) {
  const { accountList } = useGetAccounts()

  const account = accountList[entry.accountId]

  if (entry.errorMessage) {
    return (
      <Panel className="px-4 py-3">
        <p className="text-[0.8125rem] font-medium">
          {parseCustomDisplayName(account)}
        </p>
        <p className="mt-1 text-xs text-destructive">{entry.errorMessage}</p>
      </Panel>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card/40">
      {/*
        A single dossier band rather than the row of separate cards this used
        to be — the headline numbers belong to the same account, so boxing
        each one made the page read as unrelated fragments.
      */}
      <header className="border-b border-border/60 bg-gradient-to-r from-primary/[0.09] to-transparent px-6 py-5">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Commander dossier
            </p>
            <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold leading-tight">
              <span className="truncate">
                {parseCustomDisplayName(account)}
              </span>
              {entry.founderAccount && (
                <Chip tone="warning">Founder</Chip>
              )}
              {entry.userType && <Chip>{entry.userType}</Chip>}
            </h2>
            {entry.profileViews > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {numberWithCommaSeparator(entry.profileViews)} profile views
              </p>
            )}
          </div>

          <div className="flex items-center gap-6">
            {entry.ventures && (
              <Readout
                label="Ventures"
                sub={`lvl ${entry.ventures.level} · ${entry.ventures.availableZones} zones`}
                value={entry.ventures.powerLevel}
              />
            )}
            <Readout
              accent
              label="Power"
              value={entry.powerLevel > 0 ? entry.powerLevel : '—'}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                window.electronAPI.openExternalURL(
                  pennyDBProfileUrl(entry.displayName)
                )
              }
            >
              <ExternalLink className="size-3.5" />
              PennyDB
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              ['Account level', entry.accountLevel],
              ['Collection book', entry.collectionBookLevel],
              ['Matches', entry.matchesPlayed],
              ['Llamas opened', entry.llamasOpened],
              ['Commander', entry.commanderLevel],
              ['Days logged in', entry.daysLoggedIn],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 text-lg font-bold leading-none tabular-nums">
                {numberWithCommaSeparator(value)}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {!entry.enriched && (
        <Callout
          className="m-4"
          tone="info"
        >
          {entry.enrichmentNote ?? 'Not enriched'} — power level, hero names,
          loadouts and resources come from PennyDB.
        </Callout>
      )}

      <div className="grid gap-3 border-b border-border/60 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {fortLabels.map(([label, key]) => (
          <FortCard
            key={key}
            label={label}
            research={entry.research[key]}
            value={entry.fort[key]}
          />
        ))}
      </div>

      <Tabs
        className="px-6 py-5"
        defaultValue="overview"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="loadouts">
            Loadouts ({entry.loadouts.length})
          </TabsTrigger>
          <TabsTrigger value="resources">
            Resources ({entry.resources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-2">
            <Block title="Collection">
              <ul className="space-y-1.5">
                {(
                  [
                    ['Heroes', entry.counts.heroes],
                    ['Survivors', entry.counts.survivors],
                    ['Defenders', entry.counts.defenders],
                    ['Schematics', entry.counts.schematics],
                    ['Vault items', entry.counts.vaultItems],
                  ] as const
                ).map(([label, value]) => (
                  <Line
                    key={label}
                    label={label}
                    value={numberWithCommaSeparator(value)}
                  />
                ))}
              </ul>
            </Block>

            <Block title="Survivor squads">
              <ul className="space-y-1.5">
                {entry.squads.map((squad) => (
                  <Line
                    key={squad.id}
                    label={squad.label}
                    tone={squad.filled >= 8 ? 'good' : undefined}
                    value={`${squad.filled} / 8`}
                  />
                ))}
              </ul>
            </Block>
          </div>

          {entry.survivorBonuses.length > 0 && (
            <div className="mt-6">
              <Block title="Active survivor set bonuses">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {entry.survivorBonuses.map((bonus) => (
                    <li
                      className="rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                      key={bonus.name}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-xs font-medium">
                          {bonus.name}
                        </span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                          +{bonus.totalPct}%
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {bonus.active} active · {bonus.matched} survivors
                        {bonus.fortStat && ` · ${bonus.fortStat}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Block>
            </div>
          )}
        </TabsContent>

        <TabsContent value="loadouts">
          {entry.loadouts.length === 0 ? (
            <Empty>No loadouts available.</Empty>
          ) : (
            <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {entry.loadouts.map((loadout) => (
                <LoadoutCard
                  key={`${loadout.index}-${loadout.commander.name}`}
                  loadout={loadout}
                />
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="resources">
          {entry.resources.length === 0 && entry.llamas.length === 0 ? (
            <Empty>No resource data.</Empty>
          ) : (
            <div className="space-y-6">
              {entry.llamas.length > 0 && (
                <Block title="Llamas">
                  <ResourceGrid items={entry.llamas} />
                </Block>
              )}
              {entry.resources.length > 0 && (
                <Block title="Resources">
                  <ResourceGrid items={entry.resources} />
                </Block>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </section>
  )
}

function Readout({
  accent,
  label,
  sub,
  value,
}: {
  accent?: boolean
  label: string
  sub?: string
  value: number | string
}) {
  return (
    <div className="text-right">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'font-bold leading-none tabular-nums',
          accent ? 'text-3xl text-primary' : 'text-xl'
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{sub}</p>
      )}
    </div>
  )
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode
  tone?: 'warning'
}) {
  return (
    <span
      className={cn(
        'rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide',
        tone === 'warning'
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-border/70 text-muted-foreground'
      )}
    >
      {children}
    </span>
  )
}

function FortCard({
  label,
  research,
  value,
}: {
  label: string
  research: number
  value: number
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold leading-none tabular-nums">
        {value > 0 ? numberWithCommaSeparator(value) : '—'}
      </p>
      <p className="mt-1.5 text-[0.65rem] text-muted-foreground">
        {numberWithCommaSeparator(research)} from research
      </p>
    </div>
  )
}

function Block({
  children,
  title,
}: {
  children: React.ReactNode
  title: string
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Line({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'good'
  value: string
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <span className="min-w-0 truncate text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 font-semibold tabular-nums',
          tone === 'good' && 'text-success'
        )}
      >
        {value}
      </span>
    </li>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border/70 px-4 py-8 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}

function ResourceGrid({ items }: { items: Array<ProfileResource> }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <li
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-2.5 py-2"
          key={item.name}
          title={item.name}
        >
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              className="size-7 shrink-0 object-contain"
              loading="lazy"
            />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[0.65rem] text-muted-foreground">
              {item.name}
            </span>
            <span className="block text-xs font-semibold tabular-nums">
              {numberWithCommaSeparator(item.quantity)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function LoadoutCard({ loadout }: { loadout: ProfileHeroLoadout }) {
  return (
    <li
      className={cn(
        'rounded-lg border px-3 py-2.5',
        loadout.isActive
          ? 'border-primary/50 bg-primary/[0.07]'
          : 'border-border/60 bg-background/40'
      )}
    >
      <div className="flex items-center gap-2.5">
        {loadout.commander.imageUrl ? (
          <img
            src={loadout.commander.imageUrl}
            alt=""
            className="size-10 shrink-0 rounded-md bg-muted/60 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="size-10 shrink-0 rounded-md bg-muted/60" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold">
            {loadout.commander.name}
          </span>
          <span className="block truncate text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            {loadout.commander.heroClass}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold tabular-nums">
            {loadout.commander.powerLevel}
          </span>
          {loadout.isActive && (
            <span className="text-[0.55rem] font-semibold uppercase tracking-wide text-primary">
              Active
            </span>
          )}
        </span>
      </div>

      {loadout.followers.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {loadout.followers.map((follower, index) => (
            <span
              className="flex items-center gap-1 rounded bg-muted/50 px-1 py-0.5"
              key={`${follower.name}-${index}`}
              title={`${follower.name} · ${follower.heroClass}`}
            >
              {follower.imageUrl && (
                <img
                  src={follower.imageUrl}
                  alt=""
                  className="size-4 rounded-sm object-cover"
                  loading="lazy"
                />
              )}
              <span className="text-[0.6rem] font-semibold tabular-nums">
                {follower.powerLevel}
              </span>
            </span>
          ))}
        </div>
      )}

      {(loadout.teamPerk || loadout.gadgets.length > 0) && (
        <p className="mt-2 truncate text-[0.65rem] text-muted-foreground">
          {[loadout.teamPerk, ...loadout.gadgets].filter(Boolean).join(' · ')}
        </p>
      )}
    </li>
  )
}
