import { UpdateIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'

import { Combobox } from '../../../components/ui/extended/combobox'
import { SeparatorWithTitle } from '../../../components/ui/extended/separator'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'

import { useInputPaddingButton } from '../../../hooks/ui/inputs'
import { useCustomizableMenuSettingsVisibility } from '../../../hooks/settings'
import { useFormData } from './-hooks'

export function SearchForm() {
  const { t } = useTranslation(['alerts', 'general'])

  const {
    $submitButton,
    accountSelectorIsDisabled,
    formDisabled,
    inputSearch,
    inputSearchButtonIsDisabled,
    options,
    searchIsSubmitting,

    customFilter,
    handleChangeSearchDisplayName,
    handleSearchPlayer,
    onSelectItem,
  } = useFormData()
  const { getMenuOptionVisibility } =
    useCustomizableMenuSettingsVisibility()

  const [$updateInput] = useInputPaddingButton({
    customButtonRef: $submitButton,
  })

  return (
    /*
     * Opaque `bg-card` rather than the panel's translucent default: the "Or"
     * separator knocks its rule out with a chip of the surface behind it, and
     * a 60% fill over the page leaves a visible seam through the label. On a
     * wide window the two routes to a player sit side by side instead.
     */
    <div
      className="panel grid items-end gap-x-5 gap-y-3 bg-card px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      id="form-alerts-done"
    >
      <div className="space-y-2">
        {/*
          Plain <label>: the shadcn Label bakes in a `text-sm` utility, which
          outranks the `.micro-label` component class and would quietly undo it.
        */}
        <label className="micro-label">
          {t('form.accounts.select', {
            ns: 'general',
          })}
        </label>
        <Combobox
          className="max-w-full"
          emptyPlaceholder={t('form.accounts.no-options', {
            ns: 'general',
          })}
          emptyContent={t('form.accounts.search-empty', {
            ns: 'general',
          })}
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
          options={options}
          value={[]}
          customFilter={customFilter}
          onChange={() => {}}
          onSelectItem={onSelectItem}
          emptyContentClassname="py-6 text-center text-sm"
          disabled={accountSelectorIsDisabled}
          disabledItem={accountSelectorIsDisabled}
          inputSearchIsDisabled={accountSelectorIsDisabled}
          hideInputSearchWhenOnlyOneOptionIsAvailable
          hideSelectorOnSelectItem
        />
      </div>
      <SeparatorWithTitle className="bg-card text-2xs font-semibold text-muted-foreground/55 lg:hidden">
        {t('separators.or', {
          ns: 'general',
        })}
      </SeparatorWithTitle>
      {/* Side by side, the two routes to a player need only a word between them. */}
      <span className="hidden pb-2 text-xs text-muted-foreground lg:block">
        {t('separators.or', {
          ns: 'general',
        })}
      </span>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()

          if (!inputSearchButtonIsDisabled) {
            handleSearchPlayer()
          }
        }}
      >
        <label
          className="micro-label"
          htmlFor="alerts-done-input-search-player"
        >
          {t('form.search-account.label', {
            ns: 'general',
          })}
        </label>
        <div className="relative flex items-center">
          <Input
            placeholder={t('form.search-account.input.placeholder', {
              ns: 'general',
            })}
            className="h-9 pl-3 pr-[var(--pr-button-width)] text-ui"
            value={inputSearch}
            onChange={handleChangeSearchDisplayName}
            disabled={formDisabled || searchIsSubmitting}
            id="alerts-done-input-search-player"
            ref={$updateInput}
          />
          {/*
            Fixed width: the input's right padding is measured from this
            button once, so it must not resize when the spinner takes over.
          */}
          <Button
            type="submit"
            className="absolute right-1 h-7 w-24 px-2 text-caption font-semibold"
            variant="secondary"
            disabled={formDisabled || inputSearchButtonIsDisabled}
            ref={$submitButton}
          >
            {searchIsSubmitting ? (
              <UpdateIcon className="size-3.5 animate-spin" />
            ) : (
              t('actions.search', {
                ns: 'general',
              })
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
