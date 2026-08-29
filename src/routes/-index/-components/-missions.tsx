import type { PropsWithChildren } from 'react'
import type { WorldInfoMission } from '../../../types/data/advanced-mode/world-info'
import type { RewardLike } from './-mission-data'

import { UpdateIcon } from '@radix-ui/react-icons'
import {
  ChevronDown,
  Image,
  SquareCheckBigIcon,
  SquareIcon,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion'
import { Button } from '../../../components/ui/button'

import { RewardLine, RewardPayload } from './-reward-chip'

import {
  missionTypeLabel,
  resolveBrief,
  stripColon,
} from './-mission-data'

import { useAlertsDoneMarkedActions } from '../../../hooks/alerts/alerts-done'

import { useAccountScopeStore } from '../../../state/accounts/scope'

import { toast } from '../../../lib/notifications'
import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { cn } from '../../../lib/utils'

export const missionFrameClassName = 'mission-brief-frame'

/*
 * Exported so the loading skeleton is built from the same two strings the real
 * row is built from. A hand-copied silhouette drifts the first time a column
 * width changes, and the page reflows the moment data lands.
 */
export const missionCardClassName =
  'mission-brief min-h-16 w-full overflow-hidden rounded-xl border border-border/70 bg-card [border-bottom-color:hsl(var(--control-stroke))]'

export function MissionsContainer({
  children,
  className,
}: PropsWithChildren<{
  className?: string
}>) {
  return (
    <Accordion
      className={cn('grid grid-cols-1 gap-1.5', className)}
      type="multiple"
    >
      {children}
    </Accordion>
  )
}

/*
 * No `children`. The row renders its own reward content from `data`, and
 * leaving the slot open would let a caller go back to hand-assembling an icon
 * run — silently, since an ignored `children` is not a type error.
 */
export function MissionItem({
  className,
  data,
  featured,
  hideCompletedCheck,
  hideScreenshotButton,
}: {
  className?: string
  data: WorldInfoMission
  /**
   * The reward the calling section exists to show. When set it becomes the
   * payload and drops out of the meta strip; when omitted the payload falls
   * back to the first alert reward, else the biggest base reward.
   */
  featured?: RewardLike
  hideCompletedCheck?: boolean
  hideScreenshotButton?: boolean
}) {
  const { t } = useTranslation(['alerts'])

  const {
    raw: {
      mission: { missionGuid },
    },
    ui: { alert, mission, powerLevel },
  } = data

  const selected = useAccountScopeStore((state) => state.primary)
  const { isCompleted } = useAlertsDoneMarkedActions({
    accountId: selected,
    missionGuid,
  })

  const brief = resolveBrief(data, featured)
  const showCheck = selected !== null && !hideCompletedCheck
  const isBanked = isCompleted && !hideCompletedCheck
  const typeLabel = missionTypeLabel(mission.zone.type.id)

  return (
    <div
      className={cn(
        'group/brief',
        missionFrameClassName,
        isBanked && 'opacity-60',
      )}
    >
      {/*
        Read-only. Completion is synced from the account's own mission alert
        claim record, so a manual tick could only ever disagree with what Epic
        already knows.

        The empty span keeps the gutter reserved when the tick is hidden, so an
        Alerts Done row lines up with an Alerts Overview row.
      */}
      {showCheck ? (
        <span
          className={cn(
            'flex h-16 items-center justify-center',
            isCompleted ? 'text-success' : 'text-muted-foreground/40',
          )}
          title={t(
            isCompleted
              ? 'information.completed-from-account'
              : 'information.not-completed-yet',
          )}
        >
          {isCompleted ? (
            <SquareCheckBigIcon size={14} />
          ) : (
            <SquareIcon size={14} />
          )}
        </span>
      ) : (
        <span aria-hidden />
      )}

      <AccordionItem
        className={cn('item group/item min-w-0 border-b-0', className)}
        id={`mission-${missionGuid}`}
        value={missionGuid}
      >
        {/*
          `hideIcon` frees the chevron from the trigger's own flex row so it can
          sit in the card's last column, on the same x-coordinate as every other
          row's chevron.
        */}
        <AccordionTrigger
          className="block w-full p-0 text-left hover:no-underline"
          hideIcon
        >
          <span
            className={cn(
              missionCardClassName,
              'mission-preview text-left transition-colors group-hover/brief:border-primary/40',
            )}
          >
            <span
              aria-hidden
              className="h-full w-full"
              style={{ backgroundColor: mission.zone.color }}
            />

            <span
              className="relative flex items-center justify-center border-r border-border/50"
              style={{ color: mission.zone.color }}
            >
              {/*
                Tailwind's opacity modifiers cannot compose with an arbitrary
                hex arriving from data, so the fill is currentColor at 8%.
              */}
              <span
                aria-hidden
                className="absolute inset-0 bg-current opacity-[0.08]"
              />
              {mission.zone.iconUrl ? (
                <img
                  src={mission.zone.iconUrl}
                  alt=""
                  className="relative size-5 object-contain"
                  loading="lazy"
                />
              ) : (
                <span className="figure relative text-[0.9375rem] font-bold leading-none">
                  {mission.zone.letter}
                </span>
              )}
            </span>

            {/*
              `min-w-0` or the grid refuses to shrink this column, and
              `overflow-hidden` so that whatever refuses to shrink inside it —
              the type glyph, the meta strip — is clipped at the column edge
              instead of painting over the power figure and the payload bay.
            */}
            <span className="flex min-w-0 items-center gap-3 overflow-hidden py-2.5 pl-3 pr-2 compact:gap-2 compact:pl-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted/40 ring-1 ring-inset ring-border/60 transition-colors group-hover/brief:ring-primary/25 compact:size-8">
                <img
                  src={mission.zone.type.imageUrl}
                  alt=""
                  className="ink-glyph size-6 object-contain compact:size-5"
                  loading="lazy"
                />
              </span>

              <span className="flex min-w-0 flex-col gap-1.5">
                {/*
                  The tile index is the only identifier a mission without a
                  mapped category has; a row with no words at all is the thing
                  this redesign exists to remove.
                */}
                <span
                  className="truncate text-sm font-semibold leading-tight text-foreground"
                  title={typeLabel ?? undefined}
                >
                  {typeLabel ?? `#${data.raw.mission.tileIndex}`}
                </span>

                <span className="mission-meta flex min-w-0 items-center gap-2 text-[0.6875rem] leading-none text-muted-foreground/70">
                  {brief.meta.map((reward) => (
                    <span
                      className="flex shrink-0 items-center gap-0.5"
                      key={reward.itemId}
                    >
                      <img
                        src={reward.imageUrl}
                        alt=""
                        className={cn(
                          'size-4 shrink-0 object-contain',
                          reward.isBad &&
                            'rounded-sm ring-1 ring-inset ring-destructive/60',
                        )}
                        loading="lazy"
                      />
                      {reward.quantity > 1 && (
                        <span className="figure">
                          ×{numberWithCommaSeparator(reward.quantity)}
                        </span>
                      )}
                      {reward.isBad && (
                        <span className="font-semibold uppercase tracking-[0.06em] text-destructive">
                          {t('sections.twine-peaks.mid')}
                        </span>
                      )}
                    </span>
                  ))}

                  {brief.meta.length > 0 && mission.modifiers.length > 0 && (
                    <span
                      aria-hidden
                      className="h-3 w-px shrink-0 bg-border"
                    />
                  )}

                  {/*
                    A modifier is a caveat, not a headline: greyscale until
                    hover. The glyphs inside these badges are white, so on a
                    light page greyscale-plus-fade alone erases them — light
                    mode also darkens the whole icon into a silhouette, while
                    dark mode keeps the original half-fade untouched.
                  */}
                  {mission.modifiers.slice(0, 5).map((modifier) => (
                    <img
                      src={modifier.imageUrl}
                      alt=""
                      className="size-4 shrink-0 object-contain grayscale opacity-60 brightness-[0.55] transition-[opacity,filter] group-hover/brief:grayscale-0 group-hover/brief:opacity-80 group-hover/brief:brightness-100 dark:opacity-50 dark:brightness-100 dark:group-hover/brief:opacity-80"
                      key={modifier.id}
                      loading="lazy"
                    />
                  ))}
                  {mission.modifiers.length > 5 && (
                    <span className="figure shrink-0 text-muted-foreground/50">
                      +{mission.modifiers.length - 5}
                    </span>
                  )}
                </span>
              </span>
            </span>

            {/*
              A requirement, not a score. Power sits on a discrete ladder
              (1, 3, … 76, 100, 140, 160), so a bar filling toward 160 would
              read as progress the number does not represent; the bolt carries
              the unit instead, and says it in no language.

              Ventures zones with no published power report -1, hence the dash.
            */}
            <span className="flex items-center justify-end gap-1 border-l border-border/40 px-3 compact:px-1.5">
              <Zap
                aria-hidden
                className="size-3 shrink-0 fill-current text-primary/50"
              />
              <span className="figure text-xl font-bold leading-none text-foreground/90 compact:text-lg compact:leading-none">
                {powerLevel > 0 ? powerLevel : '—'}
              </span>
            </span>

            {/*
              The payload bay. Primary-tinted only while the reward is still
              claimable — a banked mission keeps its width but stops asking for
              attention.
            */}
            <span
              className={cn(
                'flex items-center border-l px-2.5 compact:px-2',
                brief.payloadIsAlert && !isBanked
                  ? 'border-primary/25 bg-primary/[0.07]'
                  : 'border-border/40 bg-muted/20',
              )}
            >
              {brief.payload ? (
                <RewardPayload
                  extraCount={brief.extraAlertCount}
                  isBanked={isBanked}
                  reward={brief.payload}
                />
              ) : (
                /* Never a skeleton: the bay holds its width so rows stay aligned. */
                <span className="micro-label">—</span>
              )}
            </span>

            <span className="flex items-center justify-center text-muted-foreground/40">
              <ChevronDown className="size-3.5 transition-transform duration-200 group-data-[state=open]/item:rotate-180" />
            </span>
          </span>
        </AccordionTrigger>

        <AccordionContent className="px-0 pb-0 pt-1.5">
          {/*
            59px = 3px rail + 44px identity + 12px, so the detail hangs off the
            same optical axis as the title it belongs to.
          */}
          <div className="ml-[3.6875rem] rounded-xl border border-border/60 bg-surface/60 p-4 [border-bottom-color:hsl(var(--control-stroke))]">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,1fr)_13rem]">
              <div className="min-w-0 space-y-4">
                {alert.rewards.length > 0 && (
                  <section>
                    <h3 className="micro-label mb-1">
                      {stripColon(t('information.alert-rewards'))}
                    </h3>
                    <ul className="divide-y divide-border/40">
                      {alert.rewards.map((reward) => (
                        <RewardLine
                          isAlert
                          key={reward.itemId}
                          reward={reward}
                        />
                      ))}
                    </ul>
                  </section>
                )}

                {mission.rewards.length > 0 && (
                  <section>
                    <h3 className="micro-label mb-1">
                      {stripColon(t('information.base-rewards'))}
                    </h3>
                    <ul className="divide-y divide-border/40">
                      {mission.rewards.map((reward) => (
                        <RewardLine
                          isBad={reward.isBad}
                          key={reward.itemId}
                          reward={reward}
                        />
                      ))}
                    </ul>
                  </section>
                )}
              </div>

              <div className="min-w-0">
                {mission.modifiers.length > 0 && (
                  <section>
                    <h3 className="micro-label mb-2">
                      {stripColon(t('information.modifiers'))}
                    </h3>
                    {/* Full colour here: expanded, the modifiers are the subject. */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {mission.modifiers.map((modifier) => (
                        <span
                          className="grid size-8 place-items-center rounded-lg bg-muted/40 ring-1 ring-inset ring-border/50"
                          key={modifier.id}
                        >
                          <img
                            src={modifier.imageUrl}
                            alt=""
                            className="size-5 object-contain"
                            loading="lazy"
                          />
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/*
                  Searching by guid is a real workflow, so these three stay
                  selectable — but they are reference material, not the reason
                  anyone opened the row, so they sit under everything else.
                */}
                <dl className="mt-4 space-y-1.5 border-t border-border/40 pt-3 text-[0.6875rem]">
                  <div>
                    <dt className="text-muted-foreground/50">
                      {stripColon(t('information.tile-index'))}
                    </dt>
                    <dd className="select-text break-all font-mono text-muted-foreground/80">
                      {data.raw.mission.tileIndex}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground/50">
                      {stripColon(t('information.alert-guid'))}
                    </dt>
                    <dd className="select-text break-all font-mono text-muted-foreground/80">
                      {alert.rewards.length > 0
                        ? data.raw.alert?.missionAlertGuid ?? 'N/A'
                        : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground/50">
                      {stripColon(t('information.mission-guid'))}
                    </dt>
                    <dd className="select-text break-all font-mono text-muted-foreground/80">
                      {data.raw.mission.missionGuid ?? 'N/A'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Outside the id element, so the button is never inside the screenshot. */}
      {hideScreenshotButton ? (
        <span aria-hidden />
      ) : (
        <ScreenshotButton id={`mission-${missionGuid}`} />
      )}
    </div>
  )
}

function ScreenshotButton({ id }: { id: string }) {
  const { t } = useTranslation(['general'])

  const [isLoading, setIsLoading] = useState(false)

  const handleGeneration = async () => {
    if (isLoading) {
      return
    }

    let $element = document.getElementById(id)

    if ($element?.getAttribute('data-state') === 'closed') {
      $element = document.querySelector(`#${id} .mission-preview`)
    }

    if (!$element) {
      return
    }

    setIsLoading(true)

    try {
      // Pulled in on demand: the screenshot library is only needed once the
      // user actually asks for one, so it stays out of the startup path.
      const { domToBlob } = await import('modern-screenshot')

      const data = await domToBlob($element, {
        backgroundColor: 'hsl(335 24% 4%)',
        type: 'image/png',
      })

      await window.navigator.clipboard.write([
        new ClipboardItem({
          'image/png': data,
        }),
      ])

      toast(t('validations.screenshot.success'))

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast(t('validations.screenshot.error'))
    }

    setIsLoading(false)
  }

  return (
    <div className="flex h-16 items-center justify-center">
      <Button
        className="size-7 p-0 text-muted-foreground/50 hover:text-foreground"
        variant="ghost"
        onClick={handleGeneration}
      >
        {isLoading ? (
          <UpdateIcon className="size-4 animate-spin" />
        ) : (
          <Image className="size-4" />
        )}
      </Button>
    </div>
  )
}
