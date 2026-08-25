import { ChevronDown, Cog } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SeparatorWithTitle } from '../../components/ui/extended/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion'
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

