import { Clipboard } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import { Button } from '../../../../components/ui/button'
import {
  Panel,
  PanelBody,
  PanelFooter,
} from '../../../../components/page'

import { useGenerateHandlers } from './-hooks'

import { parseCustomDisplayName } from '../../../../lib/utils'

export function GenerateExchangeCodePage() {
  const { t } = useTranslation(['accounts'], {
    keyPrefix: 'exchange-code.form.generate-code',
  })

  const {
    generatedCode,
    selected,
    handleCopyCode,
    handleGenerateExchange,
  } = useGenerateHandlers()

  return (
    <>
      <Panel>
        <PanelBody className="grid gap-4">
          <p className="text-[0.8125rem] text-muted-foreground">
            <Trans
              ns="general"
              i18nKey="account-selected"
              values={{
                name: parseCustomDisplayName(selected),
              }}
            >
              Account selected:{' '}
              <span className="font-semibold text-foreground">
                {parseCustomDisplayName(selected)}
              </span>
            </Trans>
          </p>
          <InputSecret
            buttonProps={{
              disabled: generatedCode === null,
              onClick: handleCopyCode,
            }}
            inputProps={{
              placeholder: t('input.placeholder'),
              value: generatedCode ?? '',
              disabled: true,
            }}
            iconButton={<Clipboard size={16} />}
          />
        </PanelBody>
        <PanelFooter>
          <Button
            className="w-full"
            onClick={handleGenerateExchange}
          >
            {t('submit-button')}
          </Button>
        </PanelFooter>
      </Panel>
    </>
  )
}
