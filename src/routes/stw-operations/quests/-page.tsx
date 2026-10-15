import type { QuestView } from './-hooks'
import type { QuestsPayload } from '../../../kernel/core/quests'
import type { ItemRecordMap } from '../../../kernel/core/item-database'

import { Pin, RefreshCw, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { GoToTop } from '../../../components/go-to-top'
import { ItemIcon } from '../../../components/items/item-icon'
import { Button } from '../../../components/ui/button'
import {
  AccountResourceGate,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../../components/page'

import { MAX_PINNED_QUESTS, useQuestViews, useQuestsResource } from './-hooks'

import { questRewardAmount } from '../../../config/constants/fortnite/accolade-xp'
import { cn } from '../../../lib/utils'

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
      /** Without this `LTE_Season9Wargames` reads "Season 9Wargames". */
      .replace(/(\d)([A-Za-z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  const { pinningId, resource, togglePin } = useQuestsResource()

  return (
    <div
      className="space-y-5"
      id="quests-card"
    >
      <PageHeader
        actions={
          <RefreshButton
            disabled={!resource.accountId}
            loading={resource.loading}
            onClick={resource.refresh}
          />
        }
        description="Every active quest with its objectives, progress and rewards. Pin the ones you are working on."
        icon={ScrollText}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.quests')}
      />
      <AccountResourceGate
        icon={ScrollText}
        resource={resource}
        what="the quest log"
      >
        {(data) => (
          <Content
            data={data}
            key={data.accountId}
            onTogglePin={(itemId) => togglePin(data, itemId)}
            pinningId={pinningId}
          />
        )}
      </AccountResourceGate>
      <GoToTop containerId="quests-card" />
    </div>
  )
}

function Content({
  data,
  onTogglePin,
  pinningId,
}: {
  data: QuestsPayload
  onTogglePin: (itemId: string) => void
  pinningId: string | null
}) {
  const { grouped, pinnedCount, records, total } = useQuestViews(data.quests)
  const atLimit = pinnedCount >= MAX_PINNED_QUESTS

  return (
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
          value={data.rerolls}
        />
      </StatRow>

      {grouped.map(([category, quests]) => (
        <Panel key={category}>
          <PanelHeader
            actions={<span className="micro-label">{quests.length.toLocaleString()} {quests.length === 1 ? 'quest' : 'quests'}</span>}
            compact
            title={categoryLabel(category)}
          />
          <ul className="grid xl:grid-cols-2">
            {quests.map((quest) => (
              <QuestCard
                atLimit={atLimit}
                isPinning={pinningId === quest.itemId}
                key={quest.itemId}
                onTogglePin={() => onTogglePin(quest.itemId)}
                quest={quest}
                records={records}
              />
            ))}
          </ul>
        </Panel>
      ))}

      {total <= 0 && (
        <EmptyState
          description="This account has no active quests."
          icon={ScrollText}
          title="Quest log is empty"
        />
      )}
    </>
  )
}

function QuestCard({
  atLimit,
  isPinning,
  onTogglePin,
  quest,
  records,
}: {
  atLimit: boolean
  isPinning: boolean
  onTogglePin: () => void
  quest: QuestView
  records: ItemRecordMap
}) {
  const complete = quest.progress >= 1
  const blocked = !quest.pinned && atLimit

  return (
    <li
      className={cn(
        'flex items-start gap-3 border-b border-border/50 px-4 py-3 xl:odd:border-r',
        quest.pinned && 'bg-primary/5'
      )}
    >
      <ItemIcon
        records={records}
        size="large"
        templateId={quest.templateId}
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-start gap-2">
          <span className="min-w-0 flex-1 text-ui font-semibold leading-tight">
            {quest.name}
          </span>
          <Button
            aria-label={quest.pinned ? 'Unpin quest' : 'Pin quest'}
            aria-pressed={quest.pinned}
            className={cn(
              'size-6 shrink-0 text-muted-foreground',
              quest.pinned && 'text-primary'
            )}
            disabled={isPinning || blocked}
            onClick={onTogglePin}
            size="icon"
            title={blocked ? 'Unpin a quest first — Epic allows three' : undefined}
            type="button"
            variant="ghost"
          >
            <Pin className={cn('size-3', quest.pinned && 'fill-current')} />
          </Button>
        </p>

        <ul className="mt-2 space-y-1.5">
          {quest.objectives.map((objective, index) => (
            <li key={`${objective.description}-${index}`}>
              <p className="flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {objective.description}
                </span>
                <span className="figure shrink-0">
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
                className="flex items-center gap-1 rounded-md bg-muted/50 py-0.5 pl-0.5 pr-2 figure text-xs"
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
                {questRewardAmount(reward.item, reward.quantity).toLocaleString()}
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
    </li>
  )
}
