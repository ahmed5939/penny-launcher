import { Trash2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import {
  Callout,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../components/page'

import { useGetSelectedAccount } from '../../../hooks/accounts'
import { useHandleRemove } from './-actions'

import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar'], {
    keyPrefix: 'accounts',
  })

  return (
    <>
      <PageHeader
        icon={Trash2}
        section={t('title')}
        title={t('options.remove')}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'remove-account',
  })

  const { selected } = useGetSelectedAccount()
  const { handleRemove } = useHandleRemove()

  return (
    <Panel className="max-w-xl">
      <PanelBody>
        {/*
          Removing an account is destructive and used to be phrased in the
          same muted grey as every other caption. It gets the warning
          treatment and a destructive button now.
        */}
        <Callout tone="danger">
          <Trans
            ns="accounts"
            i18nKey="remove-account.form.label"
            values={{
              name: parseCustomDisplayName(selected),
            }}
          >
            Do you want to remove{' '}
            <span className="font-bold">
              {parseCustomDisplayName(selected)}
            </span>{' '}
            account?
          </Trans>
        </Callout>
      </PanelBody>
      <PanelFooter>
        <Button
          className="ml-auto min-w-32"
          variant="destructive"
          onClick={() => handleRemove()}
        >
          {t('form.submit-button')}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
