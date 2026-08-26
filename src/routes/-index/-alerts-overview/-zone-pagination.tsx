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
  const { t } = useTranslation(['alerts'], {
    keyPrefix: 'pagination',
  })

  const { isReloading } = useWorldInfo()

  const shown =
    pagination.active === totalPages
      ? totalMissions
      : pagination.active * perPage

  /*
   * A full-width rail rather than a centred triptych: the list has to
   * terminate in something as wide as the rows above it, otherwise it just
   * trails off. The dashed edge is the same one the empty state uses, and it
   * means the same thing in both places — what you are looking for is not on
   * screen yet.
   *
   * `pagination.results` goes unused: the inline `shown/total` figure on the
   * button already says it.
   */
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {pagination.active > 1 && (
        <Button
          className="h-9 shrink-0 rounded-xl px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          variant="ghost"
          onClick={pagination.previous}
          disabled={isReloading}
        >
          {t('actions.previous')}
        </Button>
      )}
      <Button
        className="h-9 flex-1 rounded-xl border border-dashed border-border/70 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent/20 hover:text-foreground disabled:opacity-40"
        variant="ghost"
        onClick={pagination.next}
        disabled={pagination.active === totalPages || isReloading}
      >
        {t('actions.next')}
        <span className="figure ml-2 normal-case tracking-normal text-muted-foreground/60">
          {shown}/{totalMissions}
        </span>
      </Button>
    </div>
  )
}
