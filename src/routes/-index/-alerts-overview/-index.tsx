import { Filter, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { ScrollArea } from '../../../components/ui/scroll-area'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '../../../components/ui/sheet'
import { EmptyResults } from '../-components/-empty'
import {
  LoadingMissions,
  LoadingRewardsSummary,
} from '../-components/-loading'
import { RewardsSummaryList } from '../-components/-rewards-summary-list'
import { TitleSection } from '../-components/-title'
import { AlertFilters } from './-filters'

import { useAlertsOverviewData } from './-hooks'

import { ResetFiltersButton } from './-reset-filters-button'
import { ZoneSection } from './-zone-section'

import { cn } from '../../../lib/utils'

export function AlertsOverview() {
  const { t } = useTranslation(['alerts'])

  const {
    $inputSearch,
    data,
    inputSearch,
    loading,
    alertRewards,
    clearInputSearch,
    onChangeInputSearch,
  } = useAlertsOverviewData()

  return (
    <>
      {/*
        A command bar for the list below it, not a form floating above it: the
        hairline underneath is what attaches the two.
      */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <div className="flex flex-grow items-center relative">
          <Input
            className={cn('h-8 text-[0.8125rem]', {
              'pr-9': inputSearch.length > 0,
            })}
            placeholder={t('filters.search.input.placeholder')}
            value={inputSearch}
            onChange={onChangeInputSearch}
            disabled={loading.isFetching || loading.isReloading}
            ref={$inputSearch}
          />
          {inputSearch.length > 0 && (
            <Button
              className="absolute right-1 size-6 rounded"
              size="icon"
              variant="ghost"
              onClick={clearInputSearch}
            >
              <X className="size-4" />
              <span className="sr-only">clear input search</span>
            </Button>
          )}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              className="h-8 shrink-0 gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em]"
              variant="secondary"
              size="sm"
              disabled={loading.isFetching || loading.isReloading}
            >
              <Filter className="size-3.5" />
              {t('filters.search.submit-button')}
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
      </div>

      {/*
        64px rows with a 6px gutter need real air between zones, or the
        sections run together into one undifferentiated column.
      */}
      <div className="space-y-6">
        {loading.isFetching ? (
          <div className="mt-6 space-y-6">
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
                {t('information.rewards-summary')}
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
