import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from '../../lib/notifications'

/**
 * Toasts a newer stable release. Main only checks GitHub when asked, so this
 * asks once and stays quiet unless there is a release to point at.
 */
export function CheckNewVersion() {
  const { t } = useTranslation(['general'])

  useEffect(() => {
    const listener = window.electronAPI.responseNewVersionStatus(
      async (data) => {
        if (!data) {
          return
        }

        toast.info(t('version.title', { version: data.version }), {
          id: 'new-version',
          description: t('version.description'),
          duration: Infinity,
          action: {
            label: t('version.action'),
            onClick: () => window.electronAPI.openExternalURL(data.link),
          },
        })
      }
    )

    window.electronAPI.requestNewVersionStatus()

    return () => {
      listener.removeListener()
    }
  }, [t])

  return null
}
