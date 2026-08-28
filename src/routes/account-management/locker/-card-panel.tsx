import type { CosmeticMeta } from '../../../kernel/core/locker-catalog'
import type { LockerCardFilters } from '../../../kernel/core/locker'
import type { LockerCard } from '../../../state/management/locker'
import type { CardCosmeticGroup } from '../../../config/fortnite/locker'

import { useMemo } from 'react'
import { ExternalLink, ImageDown, RotateCw, Save } from 'lucide-react'

import {
  cardCosmeticGroupLabels,
  cardCosmeticGroupOrder,
  cardRarityLabels,
  cardRarityOptions,
} from '../../../config/fortnite/locker'

import { Button } from '../../../components/ui/button'
import { Label } from '../../../components/ui/label'
import { Switch } from '../../../components/ui/switch'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui/toggle-group'
import {
  Callout,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
} from '../../../components/page'

/**
 * The locker card — everything the account owns, as one image.
 *
 * Every filter is "empty means all", which is why there is no explicit "All"
 * chip to keep in sync with the rest: deselecting the last chip in a group is
 * the same statement as selecting every chip in it, and only one of those two
 * can be expressed wrongly.
 */
export function CardPanel({
  card,
  errorMessage,
  filters,
  isGenerating,
  onGenerate,
  onUpdateFilters,
  owned,
  progress,
}: {
  card: LockerCard | null
  errorMessage: string | null
  filters: LockerCardFilters
  isGenerating: boolean
  onGenerate: () => void
  onUpdateFilters: (filters: Partial<LockerCardFilters>) => void
  owned: Array<CosmeticMeta>
  progress: { done: number; total: number } | null
}) {
  /*
   * Offered chapters come from the account's own cosmetics rather than a
   * hard-coded 1–7: a new chapter ships every few months, and a list that
   * has to be edited to keep working is a list that stops working.
   */
  const chapters = useMemo(() => {
    const found = new Set<number>()

    owned.forEach((cosmetic) => {
      if (cosmetic.chapter !== null) {
        found.add(cosmetic.chapter)
      }
    })

    return [...found].sort((a, b) => a - b)
  }, [owned])

  const rarities = useMemo(() => {
    const found = new Set(owned.map((cosmetic) => cosmetic.rarity))

    return cardRarityOptions.filter((rarity) => found.has(rarity))
  }, [owned])

  return (
    <Panel>
      <PanelHeader
        description="Draws every cosmetic that matches, sorted by kind and then by rarity, and saves it as a PNG in your Pictures folder."
        title="Locker card"
      />
      <PanelBody className="space-y-4">
        <div className="space-y-2">
          <h3 className="section-label">Include</h3>
          <ToggleGroup
            className="flex-wrap justify-start"
            onValueChange={(value) =>
              onUpdateFilters({ groups: value as Array<CardCosmeticGroup> })
            }
            size="sm"
            type="multiple"
            value={filters.groups}
            variant="outline"
          >
            {cardCosmeticGroupOrder.map((group) => (
              <ToggleGroupItem
                key={group}
                value={group}
              >
                {cardCosmeticGroupLabels[group]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {rarities.length > 0 && (
          <div className="space-y-2">
            <h3 className="section-label">Rarity</h3>
            <ToggleGroup
              className="flex-wrap justify-start"
              onValueChange={(value) => onUpdateFilters({ rarities: value })}
              size="sm"
              type="multiple"
              value={filters.rarities}
              variant="outline"
            >
              {rarities.map((rarity) => (
                <ToggleGroupItem
                  key={rarity}
                  value={rarity}
                >
                  {cardRarityLabels[rarity] ?? rarity}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        {chapters.length > 0 && (
          <div className="space-y-2">
            <h3 className="section-label">Chapter</h3>
            <ToggleGroup
              className="flex-wrap justify-start"
              onValueChange={(value) =>
                onUpdateFilters({
                  chapters: value.map((chapter) => Number(chapter)),
                })
              }
              size="sm"
              type="multiple"
              value={filters.chapters.map(String)}
              variant="outline"
            >
              {chapters.map((chapter) => (
                <ToggleGroupItem
                  key={chapter}
                  value={String(chapter)}
                >
                  Chapter {chapter}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Switch
            checked={filters.equippedOnly}
            id="locker-card-equipped"
            onCheckedChange={(checked) =>
              onUpdateFilters({ equippedOnly: checked })
            }
          />
          <Label htmlFor="locker-card-equipped">
            Only what is equipped right now
          </Label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={isGenerating || owned.length === 0}
            onClick={onGenerate}
          >
            {isGenerating ? (
              <RotateCw className="mr-2 size-4 animate-spin" />
            ) : (
              <ImageDown className="mr-2 size-4" />
            )}
            Generate card
          </Button>
          {card && !isGenerating && (
            <>
              <Button
                onClick={() => window.electronAPI.openLockerCard(card.filePath)}
                variant="outline"
              >
                <ExternalLink className="mr-2 size-4" />
                Open
              </Button>
              <Button
                onClick={() =>
                  window.electronAPI.exportLockerCard(
                    card.filePath,
                    card.fileName
                  )
                }
                variant="outline"
              >
                <Save className="mr-2 size-4" />
                Save a copy
              </Button>
            </>
          )}
        </div>

        {isGenerating && (
          <div className="space-y-1">
            <ProgressBar
              total={progress?.total ?? 0}
              value={progress?.done ?? 0}
            />
            <p className="text-xs text-muted-foreground">
              {progress
                ? `Drawing ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} tiles…`
                : 'Reading the locker…'}
            </p>
          </div>
        )}

        {errorMessage && <Callout tone="danger">{errorMessage}</Callout>}

        {card && !isGenerating && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {card.count.toLocaleString()} cosmetics · {card.width}×
              {card.height} · {(card.sizeBytes / 1024 / 1024).toFixed(1)} MB ·{' '}
              {card.fileName}
            </p>
            <img
              alt={`Locker card with ${card.count} cosmetics`}
              className="w-full rounded-lg border border-border/60"
              src={card.previewDataUrl}
            />
          </div>
        )}
      </PanelBody>
    </Panel>
  )
}
