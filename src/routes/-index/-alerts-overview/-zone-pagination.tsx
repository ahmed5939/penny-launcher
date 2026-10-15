import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'

import { useWorldInfo } from '../../../hooks/advanced-mode/world-info'
import { useZoneMissionsPagination } from './-hooks'

export function ZonePagination({
  pagination,
  perPage,
  totalMissions,
  totalPages,
}: {
  totalMissions: number
} & ReturnType<typeof useZoneMissionsPagination>) {
  const { t } = useTranslation(['alerts'])

  const { isReloading } = useWorldInfo()

  const shown = pagination.active * perPage

  /*
   * A full-width rail rather than a centred triptych: the list has to
   * terminate in something as wide as the rows above it, otherwise it just
   * trails off. On the last page the rail stops offering more and ends in the
   * count instead, so the list closes on a figure rather than a control that
   * does nothing.
   *
   * `pagination.results` goes unused: the inline `shown/total` figure on the
   * button already says it.
   */
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {pagination.active > 1 && (
        <Button
          className="h-9 shrink-0 rounded-xl px-3 text-caption font-semibold text-muted-foreground hover:text-foreground"
          variant="ghost"
          onClick={pagination.previous}
          disabled={isReloading}
        >
          {t('pagination.actions.previous')}
        </Button>
      )}
      {pagination.active === totalPages ? (
        <span className="figure flex-1 px-3 text-right text-caption text-muted-foreground/60">
          {t('information.missions', {
            count: totalMissions,
            total: totalMissions,
          })}
        </span>
      ) : (
        <Button
          className="h-9 flex-1 rounded-xl text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          variant="ghost"
          onClick={pagination.next}
          disabled={isReloading}
        >
          {t('pagination.actions.next')}
          <span className="figure ml-2 normal-case tracking-normal text-muted-foreground/60">
            {shown}/{totalMissions}
          </span>
        </Button>
      )}
    </div>
  )
}
