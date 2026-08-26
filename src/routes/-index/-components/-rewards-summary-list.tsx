import { useTranslation } from 'react-i18next'

import { EmptySection } from './-empty'
import { RewardLine } from './-reward-chip'

export function RewardsSummaryList({
  rewards,
}: {
  rewards: Record<
    string,
    {
      imageUrl: string
      quantity: number
    }
  >
}) {
  const { t } = useTranslation(['alerts'])

  /*
   * Do not sort. The order is already the answer: both callers ran
   * `sortRewardsSummary` upstream, which ranks V-Bucks, then Upgrade Llama
   * tokens, then evolution materials, then PERK-UPs by rarity, then XP.
   * Ranking by quantity instead puts 20,000 ore above 100 V-Bucks.
   */
  const entries = Object.entries(rewards)

  return (
    <EmptySection
      total={entries.length}
      title={t('results.empty.rewards')}
    >
      <div className="panel overflow-hidden">
        {/*
         * The record's keys are item ids, which is what lets every total be
         * named in words through `rewardGrade` rather than shown as a bare
         * icon and a number.
         */}
        <ul className="grid grid-cols-1 gap-x-6 px-4 sm:grid-cols-2 lg:grid-cols-3 [&>li]:border-b [&>li]:border-border/40 [&>li:last-child]:border-b-0">
          {entries.map(([itemId, item]) => (
            <RewardLine
              key={itemId}
              reward={{
                imageUrl: item.imageUrl,
                itemId,
                quantity: item.quantity,
              }}
            />
          ))}
        </ul>
      </div>
    </EmptySection>
  )
}
