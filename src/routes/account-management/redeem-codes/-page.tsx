import type { ChipTone } from '../../../components/page'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Ticket } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'

import { Button } from '../../../components/ui/button'
import { Textarea } from '../../../components/ui/textarea'
import {
  Chip,
  PageHeader,
  Panel,
  PanelFooter,
  PanelHeader,
  ProgressBar,
} from '../../../components/page'

import {
  RedeemCodesData,
  RedeemCodesStatus,
} from '../../../state/management/redeem-code'

import { useGetAccounts } from '../../../hooks/accounts'
import { useRedeemCodesData } from './-hooks'

import { parseRedeemCodes } from '../../../lib/parsers/texts'
import { parseCustomDisplayName } from '../../../lib/utils'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])

  return (
    <>
      <PageHeader
        icon={Ticket}
        section={t('account-management.title')}
        title={t('account-management.options.redeem-codes')}
        description="Paste one code per line and redeem them on every account in the title-bar scope."
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
    parsedSelectedAccounts,

    handleClearForm,
    handleRedeem,
    handleUpdateCodes,
  } = useRedeemCodesData()

  const codeCount = useMemo(() => parseRedeemCodes(codes).length, [codes])
  const accountNames = parsedSelectedAccounts.map((account) => account.label)

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Panel>
        <PanelHeader
          compact
          icon={Ticket}
          title="Codes"
          actions={
            codeCount > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="figure">{codeCount}</span>{' '}
                {codeCount === 1 ? 'code' : 'codes'}
              </span>
            )
          }
        />
        <Textarea
          aria-label="Codes to redeem, one per line"
          className="min-h-40 resize-none rounded-none border-0 bg-transparent px-4 py-3 font-mono text-ui focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder={'XXXXX-XXXXX-XXXXX-XXXXX\nOne code per line'}
          value={codes}
          onChange={handleUpdateCodes}
          disabled={isLoading}
        />
        <PanelFooter>
          {/* Who the codes land on, beside the button that spends them. */}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {accountNames.length === 0 ? (
              'Pick accounts in the title bar first.'
            ) : (
              <>
                On{' '}
                <span className="font-medium text-foreground">
                  {accountNames.length === 1
                    ? accountNames[0]
                    : `${accountNames.length} accounts`}
                </span>
              </>
            )}
          </span>
          <Button
            onClick={handleClearForm}
            variant="ghost"
          >
            {t('redeem-codes.form.clear-button')}
          </Button>
          <Button
            className="min-w-32"
            onClick={handleRedeem}
            disabled={isDisabledForm}
          >
            {isLoading ? (
              <UpdateIcon className="animate-spin" />
            ) : (
              t('redeem-codes.form.redeem-button')
            )}
          </Button>
        </PanelFooter>
      </Panel>

      {notifications.length > 0 && (
        <div className="space-y-3">
          {notifications.map((item) => (
            <ResponseItem
              data={item}
              key={item.account.accountId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const statusTones: Record<RedeemCodesStatus, ChipTone> = {
  [RedeemCodesStatus.ERROR]: 'danger',
  [RedeemCodesStatus.LOADING]: 'neutral',
  [RedeemCodesStatus.NOT_FOUND]: 'warning',
  [RedeemCodesStatus.OWNED]: 'success',
  [RedeemCodesStatus.SUCCESS]: 'success',
  [RedeemCodesStatus.USED]: 'warning',
}

/** One account's results: how many landed, then each code with its answer. */
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
    <Panel>
      <PanelHeader
        as="div"
        compact
        title={parseCustomDisplayName(accountList[data.account.accountId])}
        actions={
          <>
            <ProgressBar
              className="w-16"
              total={codes.length}
              value={successCounter}
            />
            <span className="figure text-xs text-muted-foreground">
              {successCounter}/{codes.length}
            </span>
          </>
        }
      />
      <ul className="divide-y divide-border/30 px-4 py-1">
        {codes.map((code, index) => (
          <li
            className="flex items-center justify-between gap-3 py-2"
            key={`${code.value}-${index}`}
          >
            <span className="min-w-0 truncate font-mono text-xs">
              {code.value}
            </span>
            {code.status === RedeemCodesStatus.LOADING ? (
              <UpdateIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Chip tone={statusTones[code.status] ?? 'danger'}>
                {statusesText[code.status] ??
                  statusesText[RedeemCodesStatus.ERROR]}
              </Chip>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}
