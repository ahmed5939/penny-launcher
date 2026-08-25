import { useTranslation } from 'react-i18next'

import { EmptySection } from './-empty'
import { RewardChip } from './-reward-chip'

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

  /** Biggest hauls first — a flat map order tells you nothing. */
  const entries = Object.entries(rewards).toSorted(
    ([, itemA], [, itemB]) => itemB.quantity - itemA.quantity
  )

  return (
    <EmptySection
      total={entries.length}
      title={t('results.empty.rewards')}
    >
      <ul className="flex flex-wrap gap-2">
        {entries.map(([itemId, item]) => (
          <li key={itemId}>
            <RewardChip
              reward={item}
              size="large"
            />
          </li>
        ))}
      </ul>
    </EmptySection>
  )
}
