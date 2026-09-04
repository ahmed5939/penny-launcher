import { Cog, LoaderCircle, Lock } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import packageJson from '../../../package.json'

import { Button } from '../../components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import {
  PageHeader,
  PageTabs,
  PageTabPanel,
  EmptyState,
} from '../../components/page'

import { AccountCustomization } from './-account-customization/-index'
import { AppSettings } from './-app-settings/-index'
import { CustomizableMenu } from './-customizable-menu/-index'
import { OverlaySettingsForm } from './-overlay-settings'

import { useGetAccounts } from '../../hooks/accounts'

import { Route } from './route'

export function RouteComponent() {
  const { t } = useTranslation(['general'])

  return (
    <>
      <PageHeader icon={Cog} title={t('settings')} />
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
  const { t } = useTranslation(['settings', 'general'])
  const { accountsArray } = useGetAccounts()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <PageTabs
      label={t('general:settings')}
      value={tab}
      tabs={[
        { value: 'app', label: t('app-settings.title') },
        { value: 'overlay', label: t('overlay.title') },
        { value: 'menu', label: t('custom-menu.title') },
        { value: 'accounts', label: t('account-customization.title') },
      ]}
      onValueChange={(value) => {
        void navigate({
          search: (previous) => ({ ...previous, tab: value }),
          resetScroll: false,
        })
      }}
    >
      <PageTabPanel value="app" activeValue={tab}>
        <div className="max-w-3xl">
          <AppSettings />
        </div>
      </PageTabPanel>
      <PageTabPanel value="overlay" activeValue={tab}>
        <div className="max-w-3xl">
          <OverlaySettingsForm />
        </div>
      </PageTabPanel>
      <PageTabPanel value="menu" activeValue={tab}>
        <div className="max-w-3xl">
          <CustomizableMenu />
        </div>
      </PageTabPanel>
      <PageTabPanel value="accounts" activeValue={tab}>
        {accountsArray.length > 0 ? (
          <div className="max-w-3xl">
            <AccountCustomization />
          </div>
        ) : (
          <EmptyState
            icon={Cog}
            title={t('general:form.accounts.no-registered-accounts')}
          />
        )}
      </PageTabPanel>
    </PageTabs>
  )
}
