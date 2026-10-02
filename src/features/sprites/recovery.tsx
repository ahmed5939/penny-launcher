import type { SpriteCollection } from '../../kernel/core/sprites'
import type { SpriteRecoveryStep } from '../../kernel/core/sprite-plan'

import { Fragment, useMemo, useState } from 'react'
import { Ghost, Sparkles } from 'lucide-react'

import { planSpriteRecovery } from '../../kernel/core/sprite-plan'

import {
  EmptyState,
  Pager,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  StatRow,
  StatTile,
  paginate,
} from '../../components/page'

import { SpriteArt, spriteName } from './sprite-art'

import { cn } from '../../lib/utils'

const pageSize = 25

/**
 * What this account's Sprite Dust can buy back, cheapest first.
 *
 * The list is the order to summon in if the aim is the most sprites for
 * the dust: the running total says where the balance runs out, and a line
 * is drawn there. Penny only plans — summoning happens in the game.
 */
export function RecoveryTab({
  collection,
  isLoading,
}: {
  collection: SpriteCollection | null
  isLoading: boolean
}) {
  const plan = useMemo(
    () => (collection ? planSpriteRecovery(collection) : null),
    [collection]
  )
  const [page, setPage] = useState(0)

  if (!plan) {
    return (
      <EmptyState
        description={
          isLoading
            ? 'Reading this account’s sprites…'
            : 'Nothing loaded yet — try Refresh.'
        }
        icon={Ghost}
        title={isLoading ? 'Loading' : 'Nothing to plan'}
      />
    )
  }

  const shown = paginate(plan.lost, page, pageSize)
  const knownCount = plan.lost.length - plan.unknownCostCount
  const lastAffordable = plan.affordableCount - 1

  const headline =
    plan.lost.length === 0
      ? 'Every sprite this account has encountered is secured.'
      : plan.dust === null
        ? `The inventory did not report a Sprite Dust balance, so how many of your ${plan.lost.length.toLocaleString()} lost sprites it covers is unavailable.`
        : `You can bring back ${plan.affordableCount.toLocaleString()} of ${plan.lost.length.toLocaleString()} lost sprites with your Sprite Dust.`

  return (
    <>
      <StatRow>
        <StatTile
          hint={plan.dust === null ? 'The inventory did not say' : 'Your balance'}
          label="Sprite Dust"
          tone="primary"
          value={plan.dust === null ? 'Unavailable' : plan.dust.toLocaleString()}
        />
        <StatTile
          hint="Encountered but not secured"
          label="Lost sprites"
          tone={plan.lost.length > 0 ? 'warning' : 'default'}
          value={plan.lost.length.toLocaleString()}
        />
        <StatTile
          hint={
            plan.unknownCostCount > 0
              ? `${plan.unknownCostCount.toLocaleString()} more with no listed cost`
              : 'For every lost sprite'
          }
          label="Cost to recover"
          value={knownCount > 0 ? plan.totalCost.toLocaleString() : '—'}
        />
      </StatRow>

      <Panel>
        <PanelHeader
          description={headline}
          icon={Sparkles}
          title="Bring back lost sprites"
        />
        {plan.lost.length > 0 && plan.totalCost > 0 && (
          <PanelBody className="space-y-2 border-b border-border/30">
            <ProgressBar
              label="Sprite Dust against the cost of every lost sprite"
              total={plan.totalCost}
              value={Math.min(plan.dust ?? 0, plan.totalCost)}
            />
            <p className="text-xs text-muted-foreground">
              {plan.dust === null ? (
                'Balance unavailable'
              ) : (
                <>
                  <span className="figure text-foreground">
                    {plan.dust.toLocaleString()}
                  </span>
                  {' of '}
                  <span className="figure">{plan.totalCost.toLocaleString()}</span>
                  {' dust needed to recover every sprite with a listed cost'}
                </>
              )}
            </p>
          </PanelBody>
        )}

        {plan.lost.length === 0 ? (
          <EmptyState
            className="border-0 bg-transparent py-8"
            description="Sprites lost in a match show up here, cheapest first, with what it takes to summon each back."
            icon={Sparkles}
            title="Nothing lost"
          />
        ) : (
          <ol className="divide-y divide-border/30">
            <li className="grid grid-cols-[2rem_minmax(0,1fr)_6rem_7rem] items-center gap-3 px-5 py-2">
              <span />
              <span className="micro-label">Sprite</span>
              <span className="micro-label text-right">Cost</span>
              <span className="micro-label text-right">Running total</span>
            </li>
            {shown.items.map((step, offset) => {
              const index = shown.page * pageSize + offset

              return (
                <Fragment key={step.entry.relicId}>
                  <RecoveryRow
                    position={index + 1}
                    step={step}
                  />
                  {index === lastAffordable &&
                    index < plan.lost.length - 1 && <RunsOut />}
                </Fragment>
              )
            })}
          </ol>
        )}

        <Pager
          onPageChange={setPage}
          page={shown.page}
          pageSize={pageSize}
          total={plan.lost.length}
        />
      </Panel>

      <AlmostComplete plan={plan} />
    </>
  )
}

function RecoveryRow({
  position,
  step,
}: {
  position: number
  step: SpriteRecoveryStep
}) {
  const { entry } = step

  return (
    <li
      className={cn(
        'grid grid-cols-[2rem_minmax(0,1fr)_6rem_7rem] items-center gap-3 px-5 py-2',
        !step.affordable && 'text-muted-foreground'
      )}
    >
      <span className="figure text-xs text-muted-foreground">{position}</span>
      <span className="flex min-w-0 items-center gap-3">
        <SpriteArt
          iconFile={entry.iconFile}
          rarity={entry.rarity}
          size="md"
        />
        <span className="min-w-0">
          <span className={cn('block truncate font-medium', step.affordable && 'text-foreground')}>
            {spriteName(entry.familyName, entry.variant, entry.variantLabel)}
          </span>
          <span className="block text-xs capitalize text-muted-foreground">
            {entry.rarity}
          </span>
        </span>
      </span>
      <span className="figure text-right text-ui">
        {step.cost === null ? (
          <span className="text-xs text-muted-foreground">Not listed</span>
        ) : (
          step.cost.toLocaleString()
        )}
      </span>
      <span className="figure text-right text-ui">
        {step.cumulative === null ? '—' : step.cumulative.toLocaleString()}
      </span>
    </li>
  )
}

/** The line where the balance stops covering the list. */
function RunsOut() {
  return (
    <li className="flex items-center gap-3 px-5 py-1.5">
      <span className="h-px flex-1 bg-warning/50" />
      <span className="text-xs text-warning">Your Sprite Dust runs out here</span>
      <span className="h-px flex-1 bg-warning/50" />
    </li>
  )
}

function AlmostComplete({
  plan,
}: {
  plan: ReturnType<typeof planSpriteRecovery>
}) {
  if (plan.almostComplete.length === 0) {
    return null
  }

  return (
    <Panel>
      <PanelHeader
        description="Sprites this account has started and is one or two treatments short of finishing. Lost ones can be summoned back; the rest have to be found."
        title="Almost complete"
      />
      <ul className="grid gap-x-6 divide-y divide-border/30 lg:grid-cols-2 lg:divide-y-0">
        {plan.almostComplete.map(({ family, needs }) => (
          <li
            className="flex items-start gap-4 px-5 py-3"
            key={family.family}
          >
            <SpriteArt
              iconFile={family.iconFile}
              rarity={family.rarity}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate text-title font-semibold">
                  {family.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <span className="figure text-foreground">{family.ownedCount}</span>
                  {' of '}
                  <span className="figure">{family.variants.length}</span>
                  {' owned'}
                </span>
              </p>
              <ul className="space-y-1">
                {needs.map((entry) => (
                  <li
                    className="flex items-center gap-2 text-ui"
                    key={entry.relicId}
                  >
                    <SpriteArt
                      dim={!entry.lost}
                      iconFile={entry.iconFile}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {entry.variantLabel}
                    </span>
                    {entry.lost ? (
                      <span className="shrink-0 text-xs text-warning">
                        {entry.summonCost === null
                          ? 'Lost · cost not listed'
                          : `Lost · ${entry.summonCost.toLocaleString()} dust`}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Never secured
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
