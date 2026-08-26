import { UpdateIcon } from '@radix-ui/react-icons'
import { Image } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../../components/ui/button'

import { BasicInformation } from './-basic-information'
import { usePlayerData } from './-hooks'
import { RewardsSummary } from './-rewards-summary'
import { SearchForm } from './-search-form'

import { toast } from '../../../lib/notifications'

export function AlertsDone() {
  return (
    <>
      {/*
        The same 8px inset as the screenshot container below, so the form and
        the record it produces share one left edge — the container keeps its
        own padding because that inset is what gives the exported PNG a margin.
      */}
      <div className="px-2">
        <SearchForm />
        <ScreenshotGeneration />
      </div>
      <div
        className="pb-14 px-2"
        id="alerts-done-container"
      >
        <BasicInformation />
        <RewardsSummary />
      </div>
    </>
  )
}

function ScreenshotGeneration() {
  const { t } = useTranslation(['general'])

  const [isLoading, setIsLoading] = useState(false)
  const { missions } = usePlayerData()

  if (missions.size <= 0) {
    return null
  }

  const handleGeneration = async () => {
    if (isLoading) {
      return
    }

    const $element = document.getElementById('alerts-done-container')

    if (!$element) {
      return
    }

    setIsLoading(true)

    try {
      // Pulled in on demand: the screenshot library is only needed once the
      // user actually asks for one, so it stays out of the startup path.
      const { domToBlob } = await import('modern-screenshot')

      const data = await domToBlob($element, {
        backgroundColor: 'hsl(335 24% 4%)',
        type: 'image/png',
      })

      await window.navigator.clipboard.write([
        new ClipboardItem({
          'image/png': data,
        }),
      ])

      toast(t('validations.screenshot.success'))

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast(t('validations.screenshot.error'))
    }

    setIsLoading(false)
  }

  return (
    <div className="mt-6 flex justify-end">
      {/*
        A secondary command, not the screen's action: the payoff here is the
        record below it, so the button matches the mission list's command bar
        rather than competing with the search form above.
      */}
      <Button
        className="h-8 shrink-0 gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em]"
        size="sm"
        variant="secondary"
        onClick={handleGeneration}
        disabled={isLoading}
      >
        {isLoading ? (
          <UpdateIcon className="size-3.5 animate-spin" />
        ) : (
          <Image className="size-3.5" />
        )}
        {t('generate-screenshot')}
      </Button>
    </div>
  )
}
