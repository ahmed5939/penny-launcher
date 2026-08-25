import { UpdateIcon } from '@radix-ui/react-icons'
import { LogOut } from 'lucide-react'
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
import { useLeavePartyForm } from '../../../hooks/stw-operations/party'
import { useComboboxAccounts, useKickActions } from './-hooks'

export function LeavePartyCard() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const { changeClaimState, claimState, setValue, value } =
    useLeavePartyForm()
  const { customFilter, hasValues, options } = useComboboxAccounts({
    value,
  })
  const { isPending, onKick } = useKickActions({
    claimState,
    value,
    callbackName: 'notificationLeave',
  })
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  return (
    <Panel>
      <PanelHeader
        icon={LogOut}
        title={t('party.leave.form.submit-button')}
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
          <FieldRow hint={t('party.claim.title')}>
            <Switch
              onCheckedChange={changeClaimState}
              checked={claimState}
              disabled={!hasValues}
            />
          </FieldRow>
        </FieldGroup>
      </PanelBody>
      <PanelFooter>
        <Button
          className="w-full"
          size="sm"
          onClick={onKick(true)}
          disabled={!hasValues || isPending}
        >
          {isPending ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('party.leave.form.submit-button')
          )}
        </Button>
      </PanelFooter>
    </Panel>
  )
}
