import { UpdateIcon } from '@radix-ui/react-icons'
import { Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion'
import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/textarea'
import {
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  ProgressBar,
} from '../../../components/page'

import {
  RedeemCodesData,
  RedeemCodesStatus,
} from '../../../state/management/redeem-code'

import { useGetAccounts } from '../../../hooks/accounts'
import { useRedeemCodesData } from './-hooks'

import { cn, parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])

  return (
    <>
      <PageHeader
        icon={Ticket}
        section={t('account-management.title')}
        title={t('account-management.options.redeem-codes')}
        description={t('redeem-codes.description', {
          ns: 'account-management',
        })}
      />
      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['account-management', 'general'])

  const {
    codes,
    isDisabledForm,
    isLoading,
    notifications,

    handleClearForm,
    handleRedeem,
    handleUpdateCodes,
  } = useRedeemCodesData()

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/*
        Still a real form — codes have to come from somewhere — but the
        account half of it is gone; the titlebar picker answers that.
      */}
      <Panel>
        <PanelBody>
          <FieldGroup>
            <FieldRow
              label={t('redeem-codes.form.input.placeholder')}
              stacked
            >
              <Textarea
                className="min-h-32 resize-none"
                placeholder={t('redeem-codes.form.input.placeholder')}
                value={codes}
                onChange={handleUpdateCodes}
                disabled={isLoading}
              />
            </FieldRow>
          </FieldGroup>
        </PanelBody>
        <PanelFooter>
          <Button
            className="flex-1"
            onClick={handleRedeem}
            disabled={isDisabledForm}
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              <span className="truncate">
                {t('redeem-codes.form.redeem-button')}
              </span>
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleClearForm}
            variant="secondary"
          >
            <span className="truncate">
              {t('redeem-codes.form.clear-button')}
            </span>
          </Button>
        </PanelFooter>
      </Panel>

      {notifications.length > 0 && (
        <Accordion
          className="flex flex-col gap-2"
          type="multiple"
        >
          {notifications.map((item) => (
            <ResponseItem
              data={item}
              key={item.account.accountId}
            />
          ))}
        </Accordion>
      )}
    </div>
  )
}

function ResponseItem({ data }: { data: RedeemCodesData }) {
  const { i18n, t } = useTranslation(['general'])

  const { accountList } = useGetAccounts()

  const statusesText = useMemo(
    () => ({
      [RedeemCodesStatus.ERROR]: t('statuses.error'),
      [RedeemCodesStatus.LOADING]: t('statuses.loading'),
      [RedeemCodesStatus.NOT_FOUND]: t('statuses.not-found'),
      [RedeemCodesStatus.OWNED]: t('statuses.owned'),
      [RedeemCodesStatus.SUCCESS]: t('statuses.claimed'),
      [RedeemCodesStatus.USED]: t('statuses.used'),
    }),
    [i18n.language]
  )

  const codes = Object.values(data.codes)
  const successCounter = codes.filter((code) =>
    [RedeemCodesStatus.OWNED, RedeemCodesStatus.SUCCESS].includes(
      code.status
    )
  ).length

  return (
    <AccordionItem
      className="panel border-b"
      value={data.account.accountId}
    >
      <AccordionTrigger className="gap-3 px-4 py-2.5 font-normal hover:no-underline [&>svg]:shrink-0">
        <span className="min-w-0 flex-1 truncate text-left text-[0.8125rem] font-medium">
          {parseCustomDisplayName(accountList[data.account.accountId])}
        </span>
        {/* "3/8" alone made you compare two numbers; the bar shows it. */}
        <ProgressBar
          className="w-16 shrink-0"
          total={codes.length}
          value={successCounter}
        />
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {successCounter}/{codes.length}
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-3">
        <ul className="divide-y divide-border/40">
          {codes.map((code, index) => (
            <li
              className="flex items-center justify-between gap-3 py-1.5"
              key={`${code.value}-${index}`}
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {code.value}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide',
                  {
                    'bg-destructive/15 text-destructive':
                      code.status === RedeemCodesStatus.ERROR,
                    'bg-muted text-muted-foreground':
                      code.status === RedeemCodesStatus.LOADING ||
                      [
                        RedeemCodesStatus.NOT_FOUND,
                        RedeemCodesStatus.USED,
                      ].includes(code.status),
                    'bg-success/15 text-success': [
                      RedeemCodesStatus.OWNED,
                      RedeemCodesStatus.SUCCESS,
                    ].includes(code.status),
                  }
                )}
              >
                {statusesText[code.status] ??
                  statusesText[RedeemCodesStatus.ERROR]}
              </span>
            </li>
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  )
}
