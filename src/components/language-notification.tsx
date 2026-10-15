import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'

import {
  availableLanguages,
  defaultAppLanguage,
} from '../config/constants/settings'
import { Language } from '../locales/resources'

import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'

import { useLanguage } from '../hooks/language'

import { changeDateLocale } from '../lib/dates'

export const LanguageNotification = memo(() => {
  const { i18n, t } = useTranslation(['settings', 'general'])

  const [selected, setSelected] = useState<Language>()

  const { language: currentLanguage, updateLanguage } = useLanguage()

  if (currentLanguage !== null) {
    return null
  }

  const handleConfirmSelection = () => {
    if (!selected) {
      return
    }

    window.electronAPI.changeAppLanguage(selected)
    updateLanguage(selected)
    i18n.changeLanguage(selected)
    changeDateLocale(selected)
  }

  return (
    <Dialog defaultOpen>
      <DialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        hideCloseButton
      >
        <DialogHeader className="text-left">
          <DialogTitle>
            {t('app-settings.form.language.dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('app-settings.form.language.dialog.notes.2')}
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          onValueChange={(value: Language) => setSelected(value)}
          value={selected}
        >
          {availableLanguages.map((language) => (
            <label
              className="flex items-center gap-3 rounded-md px-3 py-2 text-ui hover:bg-muted/50 has-[[data-state=checked]]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
              key={language.id}
            >
              <RadioGroupItem
                value={language.id}
                autoFocus={language.id === defaultAppLanguage}
              />
              <span>
                {language.title}
                {language.completed === false && (
                  <span className="text-muted-foreground">
                    {` ${t('under-translation', { ns: 'general' })}`}
                  </span>
                )}
              </span>
            </label>
          ))}
        </RadioGroup>

        <Button
          variant="default"
          onClick={handleConfirmSelection}
          disabled={!selected}
        >
          {t('app-settings.form.language.dialog.submit-button')}
        </Button>
      </DialogContent>
    </Dialog>
  )
})
