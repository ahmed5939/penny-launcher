import type { AccountData } from '../../../types/accounts'

import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

import { checkIfCustomDisplayNameIsValid } from '../../../lib/validations/properties'
import { useActions, useDisplayNameInputField } from './-hooks'

/**
 * One account: who it is on the left, its nickname field and Change on the
 * right — the label-and-control shape of every other settings row.
 */
export function AccountItem({
  account,
  isPendingSubmitCustomDisplayName,
  onSubmitCustomDisplayName,
}: {
  account: AccountData
} & ReturnType<typeof useActions>) {
  const { t } = useTranslation(['general'])

  const { customDisplayName, onChangeInputDisplayNameValue } =
    useDisplayNameInputField({
      defaultValue: account.customDisplayName,
    })

  const nickname = checkIfCustomDisplayNameIsValid(account.customDisplayName)
    ? account.customDisplayName
    : null
  const unchanged = customDisplayName.trim() === (account.customDisplayName ?? '').trim()

  return (
    <form
      className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2"
      onSubmit={onSubmitCustomDisplayName({
        account,
        value: customDisplayName,
      })}
    >
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-ui font-medium">
          {nickname ?? account.displayName}
        </p>
        {nickname && (
          <p className="truncate text-xs text-muted-foreground">
            {account.displayName}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          aria-label={`Nickname for ${account.displayName}`}
          className="w-56"
          disabled={isPendingSubmitCustomDisplayName}
          onChange={onChangeInputDisplayNameValue}
          placeholder={account.displayName}
          value={customDisplayName}
        />
        <Button
          disabled={isPendingSubmitCustomDisplayName || unchanged}
          type="submit"
          variant="secondary"
        >
          {t('actions.change')}
        </Button>
      </div>
    </form>
  )
}
