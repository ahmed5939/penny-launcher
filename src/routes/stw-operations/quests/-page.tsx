import type { QuestView } from './-hooks'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Pin, RefreshCw, ScrollText, UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BetaBadge } from '../../../components/navigation/beta-badge'
import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import { ItemIcon } from '../../../components/items/item-icon'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  ProgressBar,
  StatRow,
  StatTile,
} from '../../../components/page'

import { useQuestsData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

/** The game's own wording for the categories it ships. */
const categoryLabels: Record<string, string> = {
  DailyQuests: 'Daily Quests',
  Other: 'Other',
  LTE_OUTLANDISH: 'Outlandish',
  LTE_RAPTOR: 'Raptor',
  LTE_REPEATABLE: 'Repeatable Missions',
}

function categoryLabel(category: string) {
  return (
    categoryLabels[category] ??
    category
      .replace(/^LTE_/i, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])

  return (
    <>
      <PageHeader
        icon={ScrollText}
        section={t('stw-operations.title')}
        title={
          <span className="flex items-center gap-2">
            {t('stw-operations.options.quests')}
            <BetaBadge />
          </span>
        }
        description="Every active quest with its objectives, progress and rewards. Pin the ones you are working on."
      />
      <Content />
    </>
  )
}

function Content() {
  const {
    account,
    errorMessage,
    grouped,
    handleLoad,
    handleTogglePin,
    hasLoaded,
    isLoading,
    isPinning,
    pinnedCount,
    records,
    rerolls,
    total,
  } = useQuestsData()

  if (!account) {
    return (
      <EmptyState
        description="Pick one in the title bar and its quest log loads here."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  return (
    <>
      <Panel id="quests-card">
        <PanelBody className="flex flex-wrap items-center gap-3">
          <span className="text-[0.8125rem] font-medium">
            {parseCustomDisplayName(account)}
          </span>
          <Button
            className="ml-auto"
            disabled={isLoading}
            onClick={handleLoad}
            size="sm"
            variant="ghost"
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Refresh
              </>
            )}
          </Button>
        </PanelBody>
      </Panel>

      {errorMessage && (
        <Callout
          title="Could not read the quest log"
          tone="danger"
        >
          {errorMessage}
        </Callout>
      )}

      {hasLoaded && !errorMessage && (
        <>
          <StatRow className="lg:grid-cols-3">
            <StatTile
              icon={ScrollText}
              label="Active quests"
              value={total}
            />
            <StatTile
              hint="Epic allows three"
              icon={Pin}
              label="Pinned"
              tone={pinnedCount > 0 ? 'primary' : 'default'}
              value={pinnedCount}
            />
            <StatTile
              hint="Daily quest swaps"
              icon={RefreshCw}
              label="Rerolls banked"
              value={rerolls}
            />
          </StatRow>

          {grouped.map(([category, quests]) => (
            <section
              className="space-y-2"
              key={category}
            >
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {categoryLabel(category)} · {quests.length}
              </h2>
              <div className="grid gap-2 xl:grid-cols-2">
                {quests.map((quest) => (
                  <QuestCard
                    isPinning={isPinning}
                    key={quest.itemId}
                    onTogglePin={() => handleTogglePin(quest.itemId)}
                    quest={quest}
                    records={records}
                  />
                ))}
              </div>
            </section>
          ))}

          {total <= 0 && (
            <EmptyState
              description="This account has no active quests."
              icon={ScrollText}
              title="Quest log is empty"
            />
          )}
        </>
      )}

      <GoToTop containerId="quests-card" />
    </>
  )
}

function QuestCard({
  isPinning,
  onTogglePin,
  quest,
  records,
}: {
  isPinning: boolean
  onTogglePin: () => void
  quest: QuestView
  records: ItemRecordMap
}) {
  const complete = quest.progress >= 1

  return (
    <Panel className={cn(quest.pinned && 'border-primary/50')}>
      <div className="flex items-start gap-3 px-4 py-3">
        <ItemIcon
          records={records}
          size="large"
          templateId={quest.templateId}
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-start gap-2">
            <span className="min-w-0 flex-1 text-[0.8125rem] font-semibold leading-tight">
              {quest.name}
            </span>
            <button
              aria-label={quest.pinned ? 'Unpin quest' : 'Pin quest'}
              aria-pressed={quest.pinned}
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-md border transition-colors',
                quest.pinned
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-border/70 text-muted-foreground hover:text-foreground'
              )}
              disabled={isPinning}
              onClick={onTogglePin}
              type="button"
            >
              <Pin className="size-3" />
            </button>
          </p>

          <ul className="mt-2 space-y-1.5">
            {quest.objectives.map((objective, index) => (
              <li key={`${objective.description}-${index}`}>
                <p className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 flex-1 text-muted-foreground">
                    {objective.description}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {objective.completed}
                    {objective.count > 0 && ` / ${objective.count}`}
                  </span>
                </p>
                {objective.count > 0 && (
                  <ProgressBar
                    className="mt-1"
                    total={objective.count}
                    value={objective.completed}
                  />
                )}
              </li>
            ))}
          </ul>

          {quest.rewards.length > 0 && (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {quest.rewards.map((reward) => (
                <li
                  className="flex items-center gap-1 rounded-md border border-border/60 bg-surface/50 py-0.5 pl-0.5 pr-2 text-[0.65rem] tabular-nums"
                  key={reward.item}
                >
                  <ItemIcon
                    records={records}
                    size="small"
                    templateId={reward.item}
                    title={
                      reward.item.startsWith('STWAccoladeReward:')
                        ? 'Battle Pass XP'
                        : undefined
                    }
                  />
                  {reward.quantity.toLocaleString()}
                </li>
              ))}
            </ul>
          )}

          {complete && (
            <p className="mt-2 text-xs font-semibold text-success">
              Ready to claim in game
            </p>
          )}
        </div>
      </div>
    </Panel>
  )
}
