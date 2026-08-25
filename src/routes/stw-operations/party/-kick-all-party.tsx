import { UpdateIcon } from '@radix-ui/react-icons'
import { UserX } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { Button } from '../../../components/ui/button'
import { Switch } from '../../../components/ui/switch'
import {
  FieldGroup,
  FieldRow,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
} from '../../../components/page'

import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useKickAllPartyForm } from '../../../hooks/stw-operations/party'
import { useComboboxAccounts, useKickActions } from './-hooks'

export function KickAllPartyCard() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const { changeClaimState, claimState, setValue, value } =
    useKickAllPartyForm()
  const { customFilter, hasValues, options } = useComboboxAccounts({
    value,
  })
  const { isPending, onKick } = useKickActions({
    claimState,
    value,
    callbackName: 'notificationKick',
  })
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <Panel>
      <PanelHeader
        icon={UserX}
        title={t('party.kick.form.submit-button')}
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
            />
          </FieldRow>
          <FieldRow hint={t('party.claim.title')}>
            <Switch
              checked={claimState}
              onCheckedChange={changeClaimState}
              disabled={!hasValues}
            />
          </FieldRow>
        </FieldGroup>
      </PanelBody>
      <PanelFooter>
        <Button
          className="w-full"
          size="sm"
          onClick={onKick()}
          disabled={!hasValues || isPending}
        >
          {isPending ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('party.kick.form.submit-button')
          )}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
