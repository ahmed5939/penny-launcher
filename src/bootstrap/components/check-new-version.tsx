import { BellRing } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'

import { useCheckNewVersion } from './hooks'

export function CheckNewVersion() {
  const { t } = useTranslation(['general'])

  const { data, handleGoToNewRelease } = useCheckNewVersion()

  if (!data) {
    return null
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
      <BellRing className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">
          {t('version.title', {
            version: data.version,
          })}
        </span>
        <span className="text-muted-foreground">
          {' — '}
          {t('version.description')}
        </span>
      </p>
      <Button
        className="shrink-0"
        size="sm"
        variant="secondary"
        onClick={handleGoToNewRelease}
      >
        {t('version.action')}
      </Button>
    </div>
  )
}
