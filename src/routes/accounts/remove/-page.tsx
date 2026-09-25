import { Trash2, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelFooter,
} from '../../../components/page'

import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useHandleRemove } from './-actions'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'accounts',
  })
  const { selected } = useGetSelectedAccount()

  return (
    <>
      <PageHeader
        icon={Trash2}
        section={t('title')}
        title={t('options.remove')}
        description="Unlink the title-bar account from Penny. The Epic account itself is not touched."
      />
      {/* Keyed so an armed confirm never carries over to another account. */}
      <Content key={selected?.accountId ?? 'none'} />
    </>
  )
}

/**
 * Removing an account changes what Penny can do, so it asks twice (§7): the
 * first press arms the button and says what goes, the second does it.
 */
function Content() {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'remove-account',
  })

  const { selected } = useGetSelectedAccount()
  const { handleRemove } = useHandleRemove()
  const [armed, setArmed] = useState(false)

  /* Disarm after a few seconds, so a stray second click later does nothing. */
  useEffect(() => {
    if (!armed) {
      return
    }

    const timer = setTimeout(() => setArmed(false), 5000)

    return () => clearTimeout(timer)
  }, [armed])

  if (!selected) {
    return (
      <EmptyState
        description="Pick the account to remove in the title bar."
        icon={UserX}
        title="No account selected"
      />
    )
  }

  const name = parseCustomDisplayName(selected)

  return (
    <Panel className="max-w-xl">
      <div className="px-5 py-5">
        <p className="text-display-sm font-bold leading-tight">{name}</p>
        <ul className="mt-3 space-y-1 text-ui text-muted-foreground">
          <li>Removes it from Penny, with its saved sign-in.</li>
          <li>Drops it from Penny's automations and auto-pins.</li>
          <li>Its Epic account, locker and progress stay as they are.</li>
        </ul>
      </div>
      <PanelFooter>
        {armed && (
          <Button
            onClick={() => setArmed(false)}
            variant="ghost"
          >
            Cancel
          </Button>
        )}
        <Button
          className="ml-auto min-w-32"
          variant={armed ? 'destructive' : 'secondary'}
          onClick={() => {
            if (!armed) {
              setArmed(true)

              return
            }

            setArmed(false)
            handleRemove()
          }}
        >
          <Trash2 className="mr-2 size-4" />
          {armed ? `Confirm — unlink ${name}` : t('form.submit-button')}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
