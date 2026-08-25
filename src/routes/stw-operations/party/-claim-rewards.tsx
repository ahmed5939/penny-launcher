import { UpdateIcon } from '@radix-ui/react-icons'
import { Gift } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import {
  FieldGroup,
  FieldRow,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useClaimRewardsForm } from '../../../hooks/stw-operations/party'
import { useClaimActions, useComboboxAccounts } from './-hooks'

export function ClaimRewardsCard() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const { setValue, value } = useClaimRewardsForm()
  const { customFilter, hasValues, options } = useComboboxAccounts({
    value,
  })
  const { isPending, onClaim } = useClaimActions({
    value,
  })
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <Panel>
      <PanelHeader
        icon={Gift}
        title={t('party.claim.form.submit-button')}
      />
      <PanelBody>
        <FieldGroup>
          <FieldRow
            label={t('form.accounts.select', { ns: 'general' })}
            stacked
          >
            <Combobox
              placeholder={t('form.accounts.select', {
                ns: 'general',
              })}
              placeholderSearch={t('form.accounts.placeholder', {
                ns: 'general',
                context: !getMenuOptionVisibility('showTotalAccounts')
                  ? 'private'
                  : undefined,
                total: options.length,
              })}
              emptyContent={t('form.accounts.search-empty', {
                ns: 'general',
              })}
              options={options}
              value={value}
              customFilter={customFilter}
              onChange={setValue}
              isMulti
            />
          </FieldRow>
        </FieldGroup>
      </PanelBody>
      <PanelFooter>
        <Button
          className="w-full"
          size="sm"
          onClick={onClaim}
          disabled={!hasValues || isPending}
        >
          {isPending ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('party.claim.form.submit-button')
          )}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
