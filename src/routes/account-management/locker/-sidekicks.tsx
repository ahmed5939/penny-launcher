import type { CompanionCollectionEntry } from '../../../kernel/core/locker-companions'
import type { SegmentedOption } from '../../../components/page'

import { useMemo, useState } from 'react'
import { Cat, PawPrint, Search } from 'lucide-react'

import { Input } from '../../../components/ui/input'
import {
  Callout,
  EmptyState,
  Panel,
  PanelBody,
  PanelHeader,
  Segmented,
  StatRow,
  StatTile,
} from '../../../components/page'

import { CosmeticTile } from './-cosmetic-tile'

import { cn } from '../../../lib/utils'

type Ownership = 'all' | 'owned' | 'missing'

const ownershipOptions: Array<SegmentedOption<Ownership>> = [
  { label: 'All', value: 'all' },
  { label: 'Owned', value: 'owned' },
  { label: 'Missing', value: 'missing' },
]

/**
 * Every sidekick Epic has released, and whether this account has it.
 *
 * The collection tab lists what is owned; this one is the inverse question —
 * "which am I still missing?" — so it is drawn from the catalogue and the
 * unowned ones stay on screen, dimmed, rather than disappearing.
 *
 * Not virtualised: there are a few dozen sidekicks in the whole game, not a
 * few thousand, and a plain wrapped row keeps them all searchable at once.
 */
export function Sidekicks({
  companions,
  errorMessage,
  isLoading,
}: {
  companions: Array<CompanionCollectionEntry>
  errorMessage: string | null
  isLoading: boolean
}) {
  const [ownership, setOwnership] = useState<Ownership>('all')
  const [query, setQuery] = useState('')

  const ownedCount = useMemo(
    () => companions.filter((entry) => entry.owned).length,
    [companions]
  )
  const missingCount = companions.length - ownedCount
  const completion =
    companions.length > 0
      ? Math.round((ownedCount / companions.length) * 100)
      : 0

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return companions.filter((entry) => {
      if (ownership === 'owned' && !entry.owned) {
        return false
      }

      if (ownership === 'missing' && entry.owned) {
        return false
      }

      return (
        needle.length === 0 ||
        entry.name.toLowerCase().includes(needle) ||
        entry.id.toLowerCase().includes(needle) ||
        (entry.description?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [companions, ownership, query])

  return (
    <>
      {errorMessage && (
        <Callout
          title="Could not list sidekicks"
          tone="warning"
        >
          {errorMessage}
        </Callout>
      )}

      <StatRow>
        <StatTile
          icon={PawPrint}
          label="Owned"
          value={ownedCount.toLocaleString()}
        />
        <StatTile
          label="Missing"
          tone={missingCount > 0 ? 'warning' : 'success'}
          value={missingCount.toLocaleString()}
        />
        <StatTile
          hint={`of ${companions.length.toLocaleString()} released`}
          label="Complete"
          value={`${completion}%`}
        />
      </StatRow>

      <Panel>
        <PanelHeader
          description="Every sidekick in the game. Greyed-out ones are not on this account yet."
          title="Sidekicks"
        />
        <PanelBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              onChange={setOwnership}
              options={ownershipOptions}
              value={ownership}
            />
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name"
                value={query}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing {visible.length.toLocaleString()} of{' '}
            {companions.length.toLocaleString()}
          </p>

          {visible.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {visible.map((entry) => (
                <div
                  className={cn(
                    'transition-opacity',
                    !entry.owned && 'opacity-45 grayscale-[35%] hover:opacity-80'
                  )}
                  key={entry.templateId}
                >
                  <CosmeticTile
                    cosmetic={entry}
                    footer={entry.owned ? 'Owned' : 'Missing'}
                    title={
                      entry.description
                        ? `${entry.name} — ${entry.description}`
                        : entry.name
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description={
                isLoading
                  ? 'Reading this account’s sidekicks…'
                  : companions.length === 0
                    ? 'Nothing loaded yet — try Reload.'
                    : ownership === 'missing'
                      ? 'Every sidekick is on this account.'
                      : 'Nothing matches that search.'
              }
              icon={Cat}
              title={isLoading ? 'Loading' : 'Nothing to show'}
            />
          )}
        </PanelBody>
      </Panel>
    </>
  )
}
