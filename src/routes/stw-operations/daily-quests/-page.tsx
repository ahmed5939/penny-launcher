import { UpdateIcon } from '@radix-ui/react-icons'
import { CalendarCheck, RefreshCw, ScrollText } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import dailyQuestsTotal from '../../../data/dailiy-quests.json'
import questRewards from '../../../data/quest-rewards.json'

import { Button } from '../../../components/ui/button'
import { GoToTop } from '../../../components/go-to-top'
import {
  Callout,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
} from '../../../components/page'

import { parseResource } from '../../../lib/parsers/resources'
import { parseCustomDisplayName } from '../../../lib/utils'

import { useDailyQuestsData } from './-hooks'

export function RouteComponent() {
  const { t } = useTranslation(['sidebar', 'stw-operations'])

  return (
    <>
      <PageHeader
        icon={CalendarCheck}
        section={t('stw-operations.title')}
        title={t('stw-operations.options.daily-quests')}
        description={t('daily-quests.description', {
          ns: 'stw-operations',
        })}
      />

      <Content />
    </>
  )
}

function Content() {
  const { t } = useTranslation(['stw-operations', 'general'])

  const {
    accountList,
    dailyQuests,
    fetchButtonIsDisabled,
    isLoading,
    rerollIsDisabled,
    rerollingQuest,

    handleFetch,
    handleReroll,
  } = useDailyQuestsData()

  return (
    <>
      {/* The account question is answered by the titlebar picker. */}
      <div className="flex items-center border-b border-border/60 pb-3">
        <Button
          className="ml-auto min-w-40"
          onClick={handleFetch}
          disabled={fetchButtonIsDisabled}
          id="load-dailies-button"
        >
          {isLoading ? (
            <UpdateIcon className="animate-spin" />
          ) : (
            t('daily-quests.form.submit-button')
          )}
        </Button>
      </div>

      {dailyQuests.length <= 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('daily-quests.list.empty')}
          description={t('daily-quests.list.description')}
        />
      ) : (
        /*
          One panel per account instead of one long card holding every
          account's quests — each block scrolls to a recognisable heading.
        */
        <div className="space-y-4">
          {dailyQuests.map((account) => {
            const accountData = accountList[account.accountId]
            const displayName = accountData
              ? parseCustomDisplayName(accountData)
              : account.accountId

            return (
              <Panel key={account.accountId}>
                <PanelHeader
                  title={displayName}
                  actions={
                    <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-muted-foreground">
                      {t('daily-quests.list.rerolls', {
                        count: account.rerolls,
                      })}
                    </span>
                  }
                />

                {account.errorMessage ? (
                  <PanelBody>
                    <Callout tone="danger">{account.errorMessage}</Callout>
                  </PanelBody>
                ) : account.quests.length <= 0 ? (
                  <PanelBody className="text-sm text-muted-foreground">
                    {t('daily-quests.list.no-quests')}
                  </PanelBody>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {account.quests.map((quest) => {
                      const isRerolling =
                        rerollingQuest?.accountId === account.accountId &&
                        rerollingQuest?.questId === quest.questId
                      const questId = quest.templateId.replace(
                        'Quest:',
                        ''
                      )
                      const questTotal = (
                        dailyQuestsTotal as Record<string, number>
                      )[questId]

                      const rewards =
                        (
                          questRewards as unknown as Record<
                            string,
                            Array<{
                              quantity: number
                              questTemplateId: string
                              templateId: string
                            }>
                          >
                        )?.[quest.templateId] ?? []

                      return (
                        <li
                          key={quest.questId}
                          className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5"
                        >
                          <div className="min-w-0 flex-1 basis-64">
                            <p className="truncate text-[0.8125rem] font-medium">
                              {t(`daily-quests.quests.${questId}`)}
                            </p>

                            <div className="mt-2 flex items-center gap-2.5">
                              <ProgressBar
                                className="max-w-56"
                                total={questTotal}
                                value={quest.progress}
                              />
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {quest.progress}/{questTotal}
                              </span>
                            </div>
                          </div>

                          <ul className="flex items-center gap-2.5">
                            {rewards.map((reward) => {
                              if (
                                !reward.templateId.startsWith(
                                  'AccountResource:'
                                )
                              ) {
                                return null
                              }

                              const resource = parseResource({
                                key: reward.templateId,
                                quantity: reward.quantity,
                              })

                              return (
                                <li
                                  className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                                  key={reward.templateId}
                                >
                                  <img
                                    src={resource.imgUrl}
                                    className="size-5"
                                    alt="icon"
                                  />
                                  {resource.quantity}
                                </li>
                              )
                            })}
                          </ul>

                          <Button
                            className="shrink-0"
                            size="sm"
                            variant="secondary"
                            disabled={
                              rerollIsDisabled || account.rerolls <= 0
                            }
                            onClick={() =>
                              handleReroll(
                                account.accountId,
                                quest.questId
                              )
                            }
                          >
                            {isRerolling ? (
                              <UpdateIcon className="animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="mr-1.5 size-3.5" />
                                {t('daily-quests.form.replace-button')}
                              </>
                            )}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Panel>
            )
          })}
        </div>
      )}

      <GoToTop containerId="load-dailies-button" />
    </>
  )
}
