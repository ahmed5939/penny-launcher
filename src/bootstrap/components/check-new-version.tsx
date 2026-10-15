import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { toast } from '../../lib/notifications'

/**
 * Toasts a newer stable release. Main only checks GitHub when asked, so this
 * asks once and stays quiet unless there is a release to point at.
 */
export function CheckNewVersion() {
  const { i18n } = useTranslation(['general'])

  useEffect(() => {
    const listener = window.electronAPI.responseNewVersionStatus(
      async (data) => {
        if (!data) {
          return
        }

        toast.info(i18n.t('version.title', { version: data.version }), {
          id: 'new-version',
          description: i18n.t('version.description'),
          duration: Infinity,
          action: {
            label: i18n.t('version.action'),
            onClick: () => window.electronAPI.openExternalURL(data.link),
          },
        })
      }
    )

    window.electronAPI.requestNewVersionStatus()

    return () => {
      listener.removeListener()
    }
  }, [i18n])

  return null
}
