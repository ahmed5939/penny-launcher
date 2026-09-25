import { SlidersHorizontal } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  FilterBar,
  SearchField,
  StatRow,
  StatTile,
} from '../../../components/page'
import { Button } from '../../../components/ui/button'
import { ScrollArea } from '../../../components/ui/scroll-area'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '../../../components/ui/sheet'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui/toggle-group'
import { EmptyResults } from '../-components/-empty'
import {
  LoadingMissions,
  LoadingRewardsSummary,
} from '../-components/-loading'
import { RewardsSummaryList } from '../-components/-rewards-summary-list'
import { TitleSection } from '../-components/-title'
import { zoneArtForTheater } from '../-components/-zone-art'
import { formatCountdown, msUntilDailyReset } from '../-home/-dashboard-model'
import { useMinuteClock } from '../-home/-dashboard-hooks'
import { AlertFilters } from './-filters'

import {
  World,
  worldNameByTheaterId,
} from '../../../config/constants/fortnite/world-info'
import { useWorldInfo } from '../../../hooks/advanced-mode/world-info'
import {
  useAlertsOverviewFiltersActions,
  useAlertsOverviewFiltersData,
} from '../../../hooks/alerts/filters'
import { useAlertsOverviewData } from './-hooks'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { assets } from '../../../lib/repository'
import { cn } from '../../../lib/utils'

import { ResetFiltersButton } from './-reset-filters-button'
import { ZoneSection } from './-zone-section'

const campaignZones = [
  World.Stonewood,
  World.Plankerton,
  World.CannyValley,
  World.TwinePeaks,
] as const

export function AlertsOverview() {
  const { t } = useTranslation(['alerts'])

  const { data, inputSearch, loading, alertRewards } = useAlertsOverviewData()
  /*
   * The kit's SearchField hands back the string, not the event, so this goes
   * to the store directly rather than through the hook's event handler. Its
   * native type="search" clear glyph replaces the hand-built X button.
   */
  const { changeInputSearch, group, missionTypes, rarities, rewards, zones } =
    useAlertsOverviewFiltersData()
  const activeFilters =
    missionTypes.length + rarities.length + rewards.length + (group ? 1 : 0)

  return (
    <>
      <TodayLine />

      {/*
        The zones are the filter everybody reaches for, so they sit in the
        strip as the game's own zone art; the rarer filters stay in the sheet.
      */}
      <FilterBar className="px-0 pt-0">
        <ZoneToggles />
        <SearchField
          className="max-w-sm"
          label={t('filters.search.input.placeholder')}
          onChange={(value) => changeInputSearch(value.replace(/\s+/g, ' '))}
          placeholder="Search missions, rewards or ids"
          value={inputSearch}
        />
        <Sheet>
          <SheetTrigger asChild>
            <Button
              className="shrink-0 gap-2"
              variant={activeFilters > 0 ? 'secondary' : 'outline'}
              size="sm"
              disabled={loading.isFetching || loading.isReloading}
            >
              <SlidersHorizontal className="size-3.5" />
              More filters
              {activeFilters > 0 && (
                <span className="figure rounded bg-primary/15 px-1 text-2xs font-semibold text-primary">
                  {activeFilters}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            className="p-0 pt-2 w-[27rem] sm:max-w-full"
            hideCloseButton
          >
            <ScrollArea
              className="h-[calc(100vh-0.5rem)]"
              id="alerts-overview-modal-content"
            >
              <AlertFilters />

              <div className="bg-background bottom-0 gap-2 grid grid-cols-2 mt-5 py-2 px-3 sticky">
                <SheetClose className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-md w-full">
                  {t('filters.actions.back')}
                </SheetClose>

                <ResetFiltersButton />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </FilterBar>

      {/*
        64px rows with a 6px gutter need real air between zones, or the
        sections run together into one undifferentiated column.
      */}
      <div className="space-y-6">
        {loading.isFetching ? (
          <div className="mt-4 space-y-6">
            {/*
              The summary panel holds its space too, so nothing below it jumps
              down the page when the totals resolve.
            */}
            <LoadingRewardsSummary />
            <LoadingMissions
              total={3}
              section
              showTitle
            />
            <LoadingMissions
              total={3}
              section
              showTitle
            />
          </div>
        ) : (
          <>
            <section
              className="mt-2"
              aria-labelledby="section-summary"
            >
              {/*
                No `accent`: the totals are not a zone, so they take the
                primary tick.
              */}
              <TitleSection
                deps={data}
                id="section-summary"
              >
                {zones.length > 0 || activeFilters > 0 || inputSearch
                  ? 'Alert rewards in these missions'
                  : 'Alert rewards today'}
              </TitleSection>
              <RewardsSummaryList rewards={alertRewards} />
            </section>

            <EmptyResults
              className="mt-6"
              total={data.size}
            >
              {data
                .entries()
                .toArray()
                .map(([theaterId, missions]) => (
                  <ZoneSection
                    missions={missions}
                    theaterId={theaterId}
                    deps={data}
                    key={theaterId}
                  />
                ))}
            </EmptyResults>
          </>
        )}
      </div>
    </>
  )
}

/**
 * The board at a glance, before any filter: how much is on it, how many
 * V-Bucks it pays, and how long until it turns over.
 */
function TodayLine() {
  const { data, isFetching } = useWorldInfo()
  const now = useMinuteClock()

  const totals = useMemo(() => {
    let missions = 0
    let alerts = 0
    let vbucks = 0
    let vbucksArt: string | undefined

    data.forEach((theater) => {
      theater.forEach((mission) => {
        missions += 1

        if (!mission.raw.alert) {
          return
        }

        alerts += 1
        mission.ui.alert.rewards.forEach((reward) => {
          if (reward.itemId.includes('currency_mtxswap')) {
            vbucks += reward.quantity
            vbucksArt ??= reward.imageUrl
          }
        })
      })
    })

    return { alerts, missions, vbucks, vbucksArt }
  }, [data])

  if (isFetching || totals.missions === 0) {
    return null
  }

  return (
    <StatRow className="pb-1">
      <StatTile
        label="V-Bucks in alerts"
        tone={totals.vbucks > 0 ? 'primary' : 'default'}
        value={
          <span className="flex items-center gap-2">
            {numberWithCommaSeparator(totals.vbucks)}
            <img
              alt=""
              className="size-6 object-contain"
              src={totals.vbucksArt ?? assets('currency_mtxswap')}
            />
          </span>
        }
      />
      <StatTile
        label="Mission alerts"
        value={numberWithCommaSeparator(totals.alerts)}
      />
      <StatTile
        label="Missions on the board"
        value={numberWithCommaSeparator(totals.missions)}
      />
      <StatTile
        hint="00:00 UTC"
        label="New board in"
        value={formatCountdown(msUntilDailyReset(now))}
      />
    </StatRow>
  )
}

/** The zone filter, drawn as the zones: key art, name, and how many missions each holds. */
function ZoneToggles() {
  const { t } = useTranslation(['zones'])
  const { data } = useWorldInfo()
  const { zones } = useAlertsOverviewFiltersData()
  const { toggleFilterKeys } = useAlertsOverviewFiltersActions()

  const counts = useMemo(() => {
    const result = new Map<string, number>()

    data.forEach((missions, theaterId) => {
      const key =
        theaterId in worldNameByTheaterId ? theaterId : 'ventures'

      result.set(key, (result.get(key) ?? 0) + missions.size)
    })

    return result
  }, [data])

  const options = [
    ...campaignZones.map((theaterId) => ({
      art: zoneArtForTheater(theaterId),
      label: t(theaterId),
      value: theaterId as string,
    })),
    { art: assets('ventures') ?? null, label: t('ventures'), value: 'ventures' },
  ]

  return (
    <ToggleGroup
      aria-label="Zones"
      className="flex-wrap justify-start gap-1.5"
      onValueChange={toggleFilterKeys('zones')}
      type="multiple"
      value={zones}
    >
      {options.map((option) => {
        const count = counts.get(option.value) ?? 0

        return (
          <ToggleGroupItem
            className={cn(
              'h-8 gap-2 rounded-lg bg-muted/40 pl-1 pr-2.5 text-xs font-medium text-muted-foreground',
              'hover:bg-muted/70 hover:text-foreground',
              'data-[state=on]:bg-primary/15 data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-inset data-[state=on]:ring-primary/40'
            )}
            disabled={count === 0}
            key={option.value}
            value={option.value}
          >
            {option.art && (
              <img
                alt=""
                className={cn(
                  'h-6 shrink-0 rounded-md',
                  option.value === 'ventures'
                    ? 'w-6 object-contain'
                    : 'w-9 object-cover'
                )}
                src={option.art}
              />
            )}
            {option.label}
            <span className="figure text-muted-foreground/70">{count}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
