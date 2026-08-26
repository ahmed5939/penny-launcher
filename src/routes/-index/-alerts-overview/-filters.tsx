import { useTranslation } from 'react-i18next'

import {
  missionTypeOptions,
  rarityOptions,
  rewardOptions,
  zoneOptions,
} from '../../../config/constants/alerts/filters'

import { Label } from '../../../components/ui/label'
import { Switch } from '../../../components/ui/switch'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '../../../components/ui/toggle-group'

import {
  useAlertsOverviewFiltersActions,
  useAlertsOverviewFiltersData,
} from '../../../hooks/alerts/filters'

import { cn } from '../../../lib/utils'

export function AlertFilters() {
  const { t } = useTranslation(['alerts'], {
    keyPrefix: 'filters',
  })

  const { missionTypes, rarities, rewards, zones, group } =
    useAlertsOverviewFiltersData()
  const { toggleFilterKeys, toggleGroup } =
    useAlertsOverviewFiltersActions()

  /*
   * The four toggle grids are identical in structure, so their appearance is
   * declared once here as descendant rules rather than repeated on every item.
   *
   * Selection reads as a primary-tinted fill with a primary border — the same
   * "this one is live" language the payload bay uses. An outline would sit
   * outside the tile's box and make a chosen filter look focused instead.
   */
  return (
    <div
      className={cn(
        'pb-0 px-6 mt-3',
        /*
         * `.micro-label` by hand: it is an `@layer components` class, and a
         * Tailwind arbitrary variant can only prefix a utility. Keep the two
         * in step.
         */
        '[&_.label]:text-[0.625rem] [&_.label]:font-semibold [&_.label]:uppercase [&_.label]:leading-none [&_.label]:tracking-[0.12em] [&_.label]:text-muted-foreground/55',
        '[&_.label-block]:mb-2.5 [&_.label-block]:inline-flex',
        '[&_.toggle-group]:flex-wrap [&_.toggle-group]:gap-2 [&_.toggle-group]:justify-start',
        '[&_.toggle-item]:size-14 [&_.toggle-item]:rounded-xl [&_.toggle-item]:border-border/70 [&_.toggle-item]:bg-muted/20 [&_.toggle-item]:px-0 [&_.toggle-item]:py-0',
        '[&_.toggle-item[data-state="on"]]:border-primary/50 [&_.toggle-item[data-state="on"]]:bg-primary/10',
        '[&_.toggle-icon]:size-8'
      )}
    >
      <div className="flex flex-col gap-6">
        <div>
          <Label className="label label-block">{t('sections.zones')}</Label>
          <ToggleGroup
            className="toggle-group"
            type="multiple"
            value={zones}
            onValueChange={toggleFilterKeys('zones')}
          >
            {zoneOptions.map((option) => (
              <ToggleGroupItem
                className="toggle-item"
                variant="outline"
                value={option.value}
                key={option.value}
              >
                {option.icon ? (
                  <img decoding="async" loading="lazy"
                    src={option.icon}
                    className="toggle-icon"
                  />
                ) : (
                  <span
                    className={cn(
                      'figure flex items-center justify-center size-8 text-2xl font-bold uppercase',
                      option.color
                    )}
                  >
                    {option.label}
                  </span>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div>
          <div className="flex items-center mb-2.5">
            <Label className="label">{t('sections.types')}</Label>
            <div className="flex gap-2 items-center ml-auto">
              <Label
                className="text-xs text-muted-foreground"
                htmlFor="group-missions"
              >
                Group Missions
              </Label>
              <Switch
                className="cursor-pointer"
                id="group-missions"
                onCheckedChange={toggleGroup}
                checked={group}
              />
            </div>
          </div>
          <ToggleGroup
            className="toggle-group"
            type="multiple"
            value={missionTypes}
            onValueChange={toggleFilterKeys('missionTypes')}
          >
            {missionTypeOptions.map((option) => (
              <ToggleGroupItem
                className="toggle-item"
                variant="outline"
                value={option.value}
                key={option.value}
              >
                <img decoding="async" loading="lazy"
                  src={option.icon}
                  className="toggle-icon"
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div>
          <Label className="label label-block">
            {t('sections.rarities')}
          </Label>
          <ToggleGroup
            className="toggle-group"
            type="multiple"
            value={rarities}
            onValueChange={toggleFilterKeys('rarities')}
          >
            {rarityOptions.map((option) => (
              <ToggleGroupItem
                className="toggle-item"
                variant="outline"
                value={option.value}
                key={option.value}
              >
                <img decoding="async" loading="lazy"
                  src={option.icon}
                  className="toggle-icon"
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div>
          <Label className="label label-block">
            {t('sections.rewards')}
          </Label>
          <ToggleGroup
            className="toggle-group"
            type="multiple"
            value={rewards}
            onValueChange={toggleFilterKeys('rewards')}
          >
            {rewardOptions.map((option) => (
              <ToggleGroupItem
                className="toggle-item"
                variant="outline"
                value={option.value}
                key={option.value}
              >
                <img decoding="async" loading="lazy"
                  src={option.icon}
                  className="toggle-icon"
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  )
}
