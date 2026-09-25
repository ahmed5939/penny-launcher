import { Clipboard } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { InputSecret } from '../../../../components/ui/extended/form/input-secret'
import { Button } from '../../../../components/ui/button'
import {
  Panel,
  PanelFooter,
  PanelHeader,
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
    <Panel>
      <PanelHeader
        as="div"
        compact
        description="For signing another app or device in as this account."
        title={
          <>
            Generate a code from{' '}
            <span className="text-primary">
              {parseCustomDisplayName(selected)}
            </span>
          </>
        }
      />
      <PanelFooter>
        <div className="min-w-0 flex-1">
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
        </div>
        <Button
          onClick={handleGenerateExchange}
          variant="secondary"
        >
          {t('submit-button')}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
