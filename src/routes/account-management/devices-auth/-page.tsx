import type { DeviceAuthInfoWithStates } from '../../../state/accounts/devices-auth'
import type { AccountData } from '../../../types/accounts'

import { UpdateIcon } from '@radix-ui/react-icons'
import { Smartphone, Trash2 } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { useState } from 'react'


import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../../components/ui/accordion'
import { Button } from '../../../components/ui/button'
import {
  FieldGroup,
  FieldRow,
  PageHeader,
  Panel,
  PanelBody,
  StatTile,
} from '../../../components/page'
import { Toggle } from '../../../components/ui/toggle'

import { useActions, useData, useParseIdentities } from './-hooks'

import { numberWithCommaSeparator } from '../../../lib/parsers/numbers'
import { getShortDateFormat, relativeTime } from '../../../lib/dates'
import { cn, parseCustomDisplayName } from '../../../lib/utils'

const dots = '•••'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'account-management'])

  return (
    <>
      <PageHeader
        icon={Smartphone}
        section={t('account-management.title')}
        title={t('account-management.options.devices-auth')}
        description={t('devices-auth.description', {
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
    data,
    disabledFetchButton,
    isFetching,
    selected,

    handleFetchDevices,
  } = useData()

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-3">
        <Panel>
          <PanelBody>
            <FieldGroup>
              <FieldRow
                label={
                  <Trans
                    ns="general"
                    i18nKey="account-selected"
                    values={{ name: parseCustomDisplayName(selected) }}
                  >
                    Account selected:{' '}
                    <span className="font-semibold text-foreground">
                      {parseCustomDisplayName(selected)}
                    </span>
                  </Trans>
                }
                stacked
              >
                <Button
                  className="w-full"
                  disabled={disabledFetchButton}
                  onClick={handleFetchDevices}
                >
                  {isFetching ? (
                    <UpdateIcon className="animate-spin h-4" />
                  ) : (
                    t('devices-auth.form.submit-button')
                  )}
                </Button>
              </FieldRow>
            </FieldGroup>
          </PanelBody>
        </Panel>

        {data.length > 0 && (
          /*
            `devices-auth.results.title` embeds its own markup for the
            count, so the tile takes the plain section name as its label
            and renders the number itself.
          */
          <StatTile
            icon={Smartphone}
            label={t('account-management.options.devices-auth', {
              ns: 'sidebar',
            })}
            value={numberWithCommaSeparator(data.length)}
          />
        )}
      </div>

      <Accordion
        className="flex flex-col gap-2"
        type="multiple"
      >
        {data.map((device, index) => (
          <DeviceItem
            account={selected!}
            data={device}
            key={index}
          />
        ))}
      </Accordion>
    </div>
  )
}

function DeviceItem({
  account,
  data,
}: {
  account: AccountData
  data: DeviceAuthInfoWithStates
}) {
  const { t } = useTranslation(['account-management', 'general'])

  const { identities } = useParseIdentities({ data })
  const { isFetching, handleRemoveDevice } = useActions()

  return (
    <AccordionItem
      className="panel border-b"
      value={data.deviceId}
    >
      <div className="flex items-center pr-2">
        <AccordionTrigger
          className={cn(
            'w-full flex-none gap-2 px-4 py-2.5 font-normal hover:no-underline [&>svg]:ml-auto [&>svg]:shrink-0'
          )}
        >
          <span className="shrink-0 font-mono text-xs">
            {data.deviceId.slice(0, 3)}•••
          </span>
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {t('devices-auth.results.item.last-access')}:{' '}
            {data.lastAccess
              ? relativeTime(data.lastAccess.dateTime)
              : t('unknown', {
                  ns: 'general',
                })}
          </span>
          {identities.length > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
              {identities.join(', ')}
            </span>
          )}
        </AccordionTrigger>
        <Button
          className="size-8 shrink-0 text-destructive/60 [&:not(:disabled)]:hover:text-destructive"
          size="icon"
          variant="ghost"
          onClick={handleRemoveDevice(account, data)}
          disabled={isFetching || data.isDeleting}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <AccordionContent className="flex flex-col gap-3 px-4 pb-4">
        <div>
          <div className="text-[0.8125rem] font-semibold">
            {t('user-agent', {
              ns: 'general',
            })}
          </div>
          <p className="break-all text-muted-foreground">
            {data.userAgent ??
              t('unknown', {
                ns: 'general',
              })}
          </p>
        </div>
        <ItemInformation
          title={t('devices-auth.results.item.created')}
          data={data.created}
        />
        <ItemInformation
          title={t('devices-auth.results.item.last-access')}
          data={data.lastAccess}
        />
      </AccordionContent>
    </AccordionItem>
  )
}

function ItemInformation({
  data,
  title,
}: {
  data?: {
    ipAddress: string
    location: string
    dateTime: string
  }
  title: string
}) {
  const { t } = useTranslation(['account-management', 'general'])

  const [isPressed, setIsPressed] = useState(false)
  const parsedDate = data?.dateTime
    ? relativeTime(data.dateTime)
    : t('unknown', {
        ns: 'general',
      })

  return (
    <div>
      <div className="flex gap-2 items-center">
        <div className="text-[0.8125rem] font-semibold">{title}</div>
        <Toggle
          className="h-auto px-2 py-1 text-xs"
          size="sm"
          variant="outline"
          pressed={isPressed}
          onPressedChange={setIsPressed}
          aria-label="toggle hidden information"
        >
          {isPressed
            ? t('hide-information', {
                ns: 'general',
              })
            : t('show-information', {
                ns: 'general',
              })}
        </Toggle>
      </div>
      <p>
        <span className="text-muted-foreground">
          {t('location', {
            ns: 'general',
          })}
          :
        </span>{' '}
        {isPressed
          ? data?.location ??
            t('unknown', {
              ns: 'general',
            })
          : dots}
      </p>
      <p>
        <span className="text-muted-foreground">
          {t('ip-address', {
            ns: 'general',
          })}
          :
        </span>{' '}
        {isPressed
          ? data?.ipAddress ??
            t('unknown', {
              ns: 'general',
            })
          : dots}
      </p>
      <p>
        <span className="text-muted-foreground">
          {t('date', {
            ns: 'general',
          })}
          :
        </span>{' '}
        {isPressed ? (
          <>
            {parsedDate}{' '}
            {data?.dateTime !== undefined && (
              <span className="text-muted-foreground text-xs">
                ({getShortDateFormat(data.dateTime)})
              </span>
            )}
          </>
        ) : (
          dots
        )}
      </p>
    </div>
  )
}

