import type {
  SpriteCollection,
  SpriteEntry,
  SpriteFamilySummary,
} from '../../../kernel/core/sprites'
import type { SegmentedOption } from '../../../components/page'

import { useMemo, useState } from 'react'
import {
  Coins,
  Ghost,
  Sparkles,
  Star,
  UserX,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { spriteIconUrl } from '../../../sprite-images'

import {
  Callout,
  Chip,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  RefreshButton,
  SearchField,
  Segmented,
  StatRow,
  StatTile,
  ToolBadges,
} from '../../../components/page'

import { CosmeticTile } from '../locker/-cosmetic-tile'

import { useSpritesPage } from './-hooks'

import { cn } from '../../../lib/utils'

type Ownership = 'all' | 'owned' | 'lost' | 'missing'

const ownershipOptions: Array<SegmentedOption<Ownership>> = [
  { label: 'All', value: 'all' },
  { label: 'Owned', value: 'owned' },
  { label: 'Lost', value: 'lost' },
  { label: 'Missing', value: 'missing' },
]

const seasonLabels: Record<string, string> = {
  c7s3: 'Ch. 7 S3',
  c7s4: 'Ch. 7 S4',
}

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'])
  const { account, collection, errorMessage, handleReload, isLoading } =
    useSpritesPage()

  return (
    <>
      <PageHeader
        actions={
          <RefreshButton
            disabled={!account}
            loading={isLoading}
            onClick={handleReload}
          />
        }
        description="Every sprite Battle Royale has released and each of its treatments: what this account owns, what it lost in the field, and what it has never secured."
        icon={Ghost}
        section={t('account-management.title')}
        status={<ToolBadges beta />}
        title="Sprites"
      />
      {account ? (
        <SpritesView
          collection={collection}
          errorMessage={errorMessage}
          isLoading={isLoading}
          key={account.accountId}
        />
      ) : (
        <EmptyState
          description="Pick one in the title bar and its sprite collection loads here."
          icon={UserX}
          title="No account selected"
        />
      )}
    </>
  )
}

/**
 * One card per creature, its treatments as a row of small tiles: solid when
 * owned, amber when lost in the field (recoverable for Sprite Dust), dimmed
 * when never secured, a star for mastered and a ring for the one that is
 * equipped. The "Missing" filter drops treatments the account already has,
 * so a card in that view is literally the shopping list for that sprite.
 */
function SpritesView({
  collection,
  errorMessage,
  isLoading,
}: {
  collection: SpriteCollection | null
  errorMessage: string | null
  isLoading: boolean
}) {
  const [ownership, setOwnership] = useState<Ownership>('all')
  const [query, setQuery] = useState('')

  const families = collection?.families ?? []
  const completeCount = families.filter((family) => family.complete).length

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return families
      .map((family) => {
        const variants = family.variants.filter(
          (sprite) => ownership === 'all' || sprite.status === ownership
        )

        return { ...family, variants }
      })
      .filter(
        (family) =>
          family.variants.length > 0 &&
          (needle.length === 0 ||
            family.name.toLowerCase().includes(needle) ||
            family.family.toLowerCase().includes(needle) ||
            (family.ability?.toLowerCase().includes(needle) ?? false))
      )
  }, [families, ownership, query])

  return (
    <>
      {errorMessage && (
        <Callout
          title="Could not read the sprite collection"
          tone="warning"
        >
          {errorMessage}
        </Callout>
      )}

      <StatRow>
        <StatTile
          hint={`of ${(collection?.totalVariants ?? 0).toLocaleString()} released`}
          icon={Sparkles}
          label="Owned"
          value={(collection?.ownedVariants ?? 0).toLocaleString()}
        />
        <StatTile
          icon={Star}
          label="Mastered"
          value={(collection?.masteredVariants ?? 0).toLocaleString()}
        />
        <StatTile
          hint="Encountered but not secured"
          label="Lost"
          tone={(collection?.lostVariants ?? 0) > 0 ? 'warning' : 'default'}
          value={(collection?.lostVariants ?? 0).toLocaleString()}
        />
        <StatTile
          hint={`of ${families.length.toLocaleString()} sprites`}
          label="Complete sets"
          tone={
            families.length > 0 && completeCount === families.length
              ? 'success'
              : 'default'
          }
          value={completeCount.toLocaleString()}
        />
        <StatTile
          hint="Summons lost sprites back"
          icon={Coins}
          label="Sprite Dust"
          value={
            collection?.spriteDust === null ||
            collection?.spriteDust === undefined
              ? '—'
              : collection.spriteDust.toLocaleString()
          }
        />
      </StatRow>

      <Panel>
        <PanelHeader
          actions={
            <span className="text-xs text-muted-foreground">
              <span className="figure">{visible.length.toLocaleString()}</span>
              {' of '}
              <span className="figure">{families.length.toLocaleString()}</span>
              {' sprites'}
            </span>
          }
          compact
          title="Collection"
        />
        <FilterBar className="px-4">
          <Segmented
            onChange={setOwnership}
            options={ownershipOptions}
            value={ownership}
          />
          <SearchField
            label="Search sprites"
            onChange={setQuery}
            placeholder="Search by name or ability"
            value={query}
          />
        </FilterBar>
        {/* The tile code, spelt out once instead of as a paragraph. */}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-foreground/70" />
            Owned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm ring-1 ring-warning" />
            Lost — summon back for Sprite Dust
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-foreground/25" />
            Never secured
          </span>
          <span className="flex items-center gap-1.5">
            <Star className="size-3 fill-warning text-warning" />
            Mastered
          </span>
        </p>
      </Panel>

      {visible.length > 0 ? (
        <div className="grid items-start gap-3 2xl:grid-cols-2">
          {visible.map((family) => (
            <SpriteFamilyCard
              family={family}
              key={family.family}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            isLoading
              ? 'Reading this account’s sprites…'
              : families.length === 0
                ? 'Nothing loaded yet — try Refresh.'
                : ownership === 'missing' || ownership === 'lost'
                  ? 'Nothing in this state — good news.'
                  : 'Nothing matches that search.'
          }
          icon={Ghost}
          title={isLoading ? 'Loading' : 'Nothing to show'}
        />
      )}
    </>
  )
}

function SpriteFamilyCard({ family }: { family: SpriteFamilySummary }) {
  const total = family.variants.length
  const season = family.season
    ? (seasonLabels[family.season] ?? family.season)
    : null

  return (
    <Panel>
      <PanelBody className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-title font-semibold">{family.name}</span>
              <Chip className="capitalize">{family.rarity}</Chip>
              {season && <Chip>{season}</Chip>}
              {family.complete && <Chip tone="success">Complete</Chip>}
            </div>
            {family.ability && (
              <p className="mt-1 text-xs text-muted-foreground">
                {family.ability}
              </p>
            )}
          </div>
          <span className="figure text-ui font-semibold">
            {family.ownedCount}
            <span className="text-muted-foreground"> / {total}</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {family.variants.map((sprite) => (
            <SpriteVariantTile
              key={sprite.relicId}
              sprite={sprite}
            />
          ))}
        </div>
      </PanelBody>
    </Panel>
  )
}

function SpriteVariantTile({ sprite }: { sprite: SpriteEntry }) {
  const detail = [
    sprite.owned ? 'Owned' : sprite.lost ? 'Lost' : 'Missing',
    sprite.mastered ? 'mastered' : null,
    sprite.equipped ? 'equipped' : null,
    sprite.xp !== null ? `${sprite.xp.toLocaleString()} XP` : null,
    sprite.lost && sprite.summonCost !== null
      ? `recover for ${sprite.summonCost.toLocaleString()} dust`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cn(
        'relative rounded-lg transition-opacity',
        sprite.status === 'missing' &&
          'opacity-45 grayscale-[35%] hover:opacity-80',
        sprite.lost && 'ring-1 ring-warning/70',
        sprite.equipped &&
          'ring-2 ring-primary ring-offset-1 ring-offset-background'
      )}
    >
      <CosmeticTile
        cosmetic={{
          color: null,
          imageUrl: spriteIconUrl(sprite.iconFile),
          name: sprite.variantLabel,
          rarity: sprite.rarity,
          seriesColors: null,
        }}
        footer={
          sprite.mastered ? (
            'Mastered'
          ) : sprite.owned ? (
            'Owned'
          ) : sprite.lost ? (
            <span className="text-warning">Lost</span>
          ) : (
            'Missing'
          )
        }
        size="small"
        title={`${sprite.familyName} — ${sprite.variantLabel}: ${detail}`}
      />
      {sprite.mastered && (
        <Star
          aria-label="Mastered"
          className="absolute right-1 top-1 size-3.5 fill-warning text-warning drop-shadow"
        />
      )}
    </div>
  )
}
