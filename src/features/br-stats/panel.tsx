import type { AccountBrStats, BrStatLine } from './model'

import { Swords } from 'lucide-react'

import {
  Callout,
  EmptyState,
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSectionHeader,
  RefreshButton,
  StatRow,
  StatTile,
} from '../../components/page'

import { useAccountBrStats } from '../../state/accounts/br-stats'

import {
  formatCount,
  formatKd,
  formatWinRate,
  inputLines,
  topPlacements,
} from './model'

/**
 * Battle Royale career stats, for the account hub.
 *
 * Read-only, and only ever the selected account's own lifetime figures on
 * its own token: wins and win rate, K/D and matches up top, then the same
 * career split by the device it was played on. An account that only plays
 * Save the World has nothing here — Epic keeps no match stats for it — so the
 * empty state says so plainly rather than looking broken.
 */
export function AccountBrStatsPanel({ accountId }: { accountId: string }) {
  const { accounts, isChecking, refresh } = useAccountBrStats()
  const entry = accounts[accountId]

  return (
    <Panel>
      <PanelHeader
        actions={
          <RefreshButton
            loading={isChecking}
            onClick={refresh}
          />
        }
        compact
        title="Battle Royale career"
      />

      <PanelBody className="space-y-6">
        <Body
          entry={entry}
          isChecking={isChecking}
        />
      </PanelBody>
    </Panel>
  )
}

/** Still reading, could not read, nothing recorded, or the career itself. */
function Body({
  entry,
  isChecking,
}: {
  entry: AccountBrStats | undefined
  isChecking: boolean
}) {
  if (!entry) {
    return (
      <p
        className="text-ui text-muted-foreground"
        role="status"
      >
        {isChecking
          ? 'Reading Battle Royale stats from Epic…'
          : 'Battle Royale stats have not been read yet.'}
      </p>
    )
  }

  if (entry.status === 'unknown') {
    return (
      <Callout
        title="Battle Royale stats unavailable"
        tone="warning"
      >
        {entry.errorMessage ?? 'Could not read Battle Royale stats. Try Refresh.'}
      </Callout>
    )
  }

  if (entry.empty) {
    return (
      <EmptyState
        className="border-0 bg-transparent py-6"
        description="Epic has no Battle Royale matches recorded for this account. Save the World keeps no match stats, so an account that only plays it shows nothing here."
        icon={Swords}
        title="No Battle Royale matches recorded"
      />
    )
  }

  const inputs = inputLines(entry)
  const tops = topPlacements(entry.overall)

  return (
    <>
      <Headline line={entry.overall} />

      {inputs.length > 0 && (
        <div>
          <PanelSectionHeader
            className="px-0"
            title="By input device"
          />
          <ul className="divide-y divide-border/30">
            {inputs.map((item) => (
              <ListRow
                caption={inputCaption(item.line)}
                figure={`${formatCount(item.line.matches)} matches`}
                key={item.input}
                name={item.label}
              />
            ))}
          </ul>
        </div>
      )}

      {tops.length > 0 && (
        <div>
          <PanelSectionHeader
            className="px-0"
            title="Top placements"
          />
          <StatRow className="pt-1">
            {tops.map((top) => (
              <StatTile
                hint="all inputs"
                key={top.tier}
                label={`Top ${top.tier}`}
                value={formatCount(top.value)}
              />
            ))}
          </StatRow>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Lifetime across every Battle Royale playlist on every platform. Save the
        World and Creative are not counted. K/D is kills per death.
      </p>
    </>
  )
}

/** The four figures that answer "how good is this account at Battle Royale". */
function Headline({ line }: { line: BrStatLine }) {
  return (
    <StatRow>
      <StatTile
        hint={`across ${formatCount(line.matches)} matches`}
        label="Wins"
        value={formatCount(line.wins)}
      />
      <StatTile
        hint="matches won"
        label="Win rate"
        value={formatWinRate(line.winRate)}
      />
      <StatTile
        hint="kills per death"
        label="K/D"
        value={formatKd(line.kd)}
      />
      <StatTile
        hint={`${formatCount(line.kills)} kills`}
        label="Matches"
        value={formatCount(line.matches)}
      />
    </StatRow>
  )
}

/** "1,234 wins · 12% win rate · 2.74 K/D" under an input's name. */
function inputCaption(line: BrStatLine) {
  return [
    `${formatCount(line.wins)} wins`,
    `${formatWinRate(line.winRate)} win rate`,
    `${formatKd(line.kd)} K/D`,
    `${formatCount(line.kills)} kills`,
  ].join(' · ')
}
