import { ChevronDown, Cog, LoaderCircle, Lock } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import packageJson from '../../../package.json'

import { SeparatorWithTitle } from '../../components/ui/extended/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion'
import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { PageHeader } from '../../components/page'

import { AccountCustomization } from './-account-customization/-index'
import { AppSettings } from './-app-settings/-index'
import { CustomizableMenu } from './-customizable-menu/-index'

import { useGetAccounts } from '../../hooks/accounts'

import { cn } from '../../lib/utils'

enum SettingsSections {
  AppSettings = 'app-settings',
  CustomizableMenu = 'customizable-menu',
  AccountCustomization = 'account-customization',
}

export function RouteComponent() {
  const { t } = useTranslation(['general'])

  return (
    <>
      <PageHeader
        icon={Cog}
        title={t('settings')}
      />
      <Content />
      <HiddenTweaksTrigger />
    </>
  )
}

/**
 * The only door to the hidden File Tweaks route: a quiet version line at
 * the foot of Settings. Seven clicks on it open a key dialog — the main
 * process gates every handler behind that key, so reaching the route
 * without it leads nowhere.
 */
const TWEAKS_TRIGGER_CLICKS = 7

function HiddenTweaksTrigger() {
  const navigate = useNavigate()

  const clicks = useRef(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [key, setKey] = useState('')
  const [isWrong, setIsWrong] = useState(false)
  const [isWorking, setIsWorking] = useState(false)

  const handleClick = () => {
    clicks.current += 1

    if (clicks.current >= TWEAKS_TRIGGER_CLICKS) {
      clicks.current = 0
      setIsDialogOpen(true)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsWorking(true)

    try {
      const unlocked = await window.electronAPI.fileTweaksUnlock(key)

      if (unlocked) {
        setIsDialogOpen(false)
        setKey('')
        void navigate({ to: '/settings/tweaks' })
      } else {
        setIsWrong(true)
      }
    } catch {
      setIsWrong(true)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <>
      <div className="mx-auto max-w-3xl pb-6 pt-2">
        <button
          className="micro-label select-none text-muted-foreground/50 hover:text-muted-foreground"
          onClick={handleClick}
          type="button"
        >
          Penny v{packageJson.version}
        </button>
      </div>

      <Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-4" />
              Restricted area
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Experimental file patching tools, gated behind a personal access
            key. Every session requires re-entering the key.
          </p>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              autoFocus
              onChange={(event) => {
                setKey(event.currentTarget.value)
                setIsWrong(false)
              }}
              placeholder="Access key"
              type="password"
              value={key}
            />
            {isWrong && <p className="text-xs text-destructive">Wrong key</p>}
            <Button
              className="w-full"
              disabled={isWorking || key.length === 0}
              type="submit"
            >
              {isWorking ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Content() {
  const { t } = useTranslation(['settings'])

  const { accountsArray } = useGetAccounts()

  return (
    <div className="max-w-3xl">
          <Accordion
            className={cn(
              'w-full',
              '[&_.section-trigger[data-state=open]_.section-icon]:rotate-180',
              '[&_.section-title]:flex [&_.section-title]:gap-1.5 [&_.section-title]:items-center',
              '[&_.section-icon]:h-4 [&_.section-icon]:w-4 [&_.section-icon]:shrink-0 [&_.section-icon]:transition-transform [&_.section-icon]:duration-200',
              '[&_.section-content]:py-6'
            )}
            type="multiple"
            defaultValue={[SettingsSections.AccountCustomization]}
          >
            <AccordionItem
              className="mb-3 rounded-xl border border-border/60 bg-card/40 px-4"
              value={SettingsSections.AppSettings}
            >
              <AccordionTrigger
                className="section-trigger"
                hideIcon
              >
                <SeparatorWithTitle className="section-title">
                  {t('app-settings.title')}{' '}
                  <ChevronDown className="section-icon" />
                </SeparatorWithTitle>
              </AccordionTrigger>
              <AccordionContent className="section-content">
                <AppSettings />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem
              className="mb-3 rounded-xl border border-border/60 bg-card/40 px-4"
              value={SettingsSections.CustomizableMenu}
            >
              <AccordionTrigger
                className="section-trigger"
                hideIcon
              >
                <SeparatorWithTitle className="section-title">
                  {t('custom-menu.title')}{' '}
                  <ChevronDown className="section-icon" />
                </SeparatorWithTitle>
              </AccordionTrigger>
              <AccordionContent className="section-content">
                <CustomizableMenu />
              </AccordionContent>
            </AccordionItem>

            {accountsArray.length > 0 && (
              <AccordionItem
                className="border-none"
                value={SettingsSections.AccountCustomization}
              >
                <AccordionTrigger
                  className="section-trigger"
                  hideIcon
                >
                  <SeparatorWithTitle className="section-title">
                    {t('account-customization.title')}{' '}
                    <ChevronDown className="section-icon" />
                  </SeparatorWithTitle>
                </AccordionTrigger>
                <AccordionContent className="section-content">
                  <AccountCustomization />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
    </div>
  )
}

