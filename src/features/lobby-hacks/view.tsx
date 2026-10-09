import type { AccountDataRecord } from '../../types/accounts'
import type { LobbyHackSubmission } from './store'

import { useNavigate } from '@tanstack/react-router'
import {
  Clapperboard,
  Gift,
  Package,
  Shirt,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'

import {
  Callout,
  Chip,
  EmptyState,
  FieldGroup,
  FilterBar,
  FieldRow,
  IconWell,
  KeyValue,
  ListRow,
  PageHeader,
  Panel,
  PanelBody,
  PanelFooter,
  PanelHeader,
  PanelSectionHeader,
  Picker,
  SearchField,
  StatusPill,
  ToolBadges,
} from '../../components/page'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'

import { useGetAccounts, useGetSelectedAccount } from '../../hooks/accounts'
import {
  checkLobbyHackCode,
  isMultiLinePaste,
  lobbyHackCodeMaxLength,
} from '../../lib/lobby-hacks'
import { numberWithCommaSeparator } from '../../lib/parsers/numbers'
import { parseCustomDisplayName } from '../../lib/utils'

import {
  type LobbyHackCodeGroup,
  groupLobbyHackCodes,
  isSubmittableCode,
  knownLobbyHackCodes,
  lobbyHackCodesCheckedAt,
} from './codes'
import {
  formAccountId,
  mayHaveGoneThrough,
  outcomeChipTone,
  outcomeTone,
} from './model'
import {
  setLobbyHackDraft,
  submitLobbyHackCode,
  useLobbyHackStore,
} from './store'

const ns = 'account-management'

/** The code field, so picking a code from the list can focus it. */
const codeFieldId = 'lobby-hack-code'

/**
 * BR Lobby Hacks: a code from the in-game Admin Panel
 * ("enter_found_lobby_hacks"), submitted for one linked account.
 *
 * The form and the result are separate panels because they can name
 * different accounts: the result always belongs to the account the code
 * was sent for, whatever the picker shows now. The season's known codes
 * sit below; picking one only fills the form.
 */
export function LobbyHacksView() {
  const { t } = useTranslation(['sidebar', ns])
  const { accountList, idsList } = useGetAccounts()
  const hasAccounts = idsList.some((accountId) => accountList[accountId])

  return (
    <>
      <PageHeader
        description={t(`${ns}:lobby-hacks.description`)}
        icon={Terminal}
        section={t('sidebar:account-management.title')}
        status={<ToolBadges beta />}
        title={t('sidebar:lobby-hacks')}
      />

      {hasAccounts ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <SubmitPanel
            accountList={accountList}
            idsList={idsList}
          />
          <ResultPanel accountList={accountList} />
        </div>
      ) : (
        <EmptyState
          description={t(`${ns}:lobby-hacks.no-accounts.description`)}
          icon={Terminal}
          title={t(`${ns}:lobby-hacks.no-accounts.title`)}
        />
      )}

      <KnownCodesPanel pickable={hasAccounts} />
    </>
  )
}

export function SubmitPanel({
  accountList,
  idsList,
}: {
  accountList: AccountDataRecord
  idsList: Array<string>
}) {
  const { t } = useTranslation([ns])
  const { selected } = useGetSelectedAccount()
  const { draft, pending } = useLobbyHackStore(
    useShallow((state) => ({ draft: state.draft, pending: state.pending }))
  )
  // The draft a multi-line paste was refused on; any change clears it.
  const [refusedOn, setRefusedOn] = useState<string | null>(null)
  const pasteRefused = refusedOn !== null && refusedOn === draft.code

  const linked = idsList.filter((accountId) => accountList[accountId])
  const accountId = formAccountId({
    chosen: draft.accountId,
    linked,
    primary: selected?.accountId ?? null,
  })
  const check = checkLobbyHackCode(draft.code)
  const busy = pending !== null
  const disabled = busy || !check.ok || !accountId

  const submit = () => {
    if (disabled || !accountId) {
      return
    }

    void submitLobbyHackCode(accountId, draft.code)
  }

  const hint = pasteRefused ? (
    <span className="text-warning">
      {t('lobby-hacks.form.problems.multi-line-paste')}
    </span>
  ) : check.ok || check.reason === 'blank' ? (
    t('lobby-hacks.form.length', {
      length: check.length,
      max: lobbyHackCodeMaxLength,
    })
  ) : (
    <span className="text-warning">
      {t(`lobby-hacks.form.problems.${check.reason}`, {
        length: check.length,
        max: lobbyHackCodeMaxLength,
      })}
    </span>
  )

  return (
    <Panel>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <PanelHeader
          description={t('lobby-hacks.form.description')}
          title={t('lobby-hacks.form.title')}
        />

        <PanelBody>
          <FieldGroup>
            <FieldRow
              hint={t('lobby-hacks.form.account-hint')}
              label={t('lobby-hacks.form.account')}
            >
              <Picker
                disabled={busy}
                label={t('lobby-hacks.form.account')}
                onChange={(value) => setLobbyHackDraft({ accountId: value })}
                options={linked.map((id) => ({
                  label: parseCustomDisplayName(accountList[id]),
                  value: id,
                }))}
                value={accountId ?? ''}
              />
            </FieldRow>

            <FieldRow
              hint={hint}
              label={t('lobby-hacks.form.code')}
              stacked
            >
              <Input
                aria-label={t('lobby-hacks.form.code')}
                autoComplete="off"
                className="font-mono"
                disabled={busy}
                id={codeFieldId}
                onChange={(event) => {
                  setRefusedOn(null)
                  setLobbyHackDraft({ code: event.target.value })
                }}
                onPaste={(event) => {
                  if (isMultiLinePaste(event.clipboardData.getData('text'))) {
                    event.preventDefault()
                    setRefusedOn(draft.code)
                  }
                }}
                placeholder={t('lobby-hacks.form.placeholder')}
                spellCheck={false}
                value={draft.code}
              />
            </FieldRow>
          </FieldGroup>
        </PanelBody>

        <PanelFooter>
          {/* Who the code lands on, beside the button that sends it. */}
          {accountId && (
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {t('lobby-hacks.form.submits-for')}{' '}
              <span className="font-medium text-foreground">
                {parseCustomDisplayName(accountList[accountId])}
              </span>
            </span>
          )}
          <Button
            className="min-w-32"
            disabled={disabled}
            type="submit"
          >
            {busy
              ? t('lobby-hacks.form.submitting')
              : t('lobby-hacks.form.submit')}
          </Button>
        </PanelFooter>
      </form>
    </Panel>
  )
}

export function ResultPanel({
  accountList,
}: {
  accountList: AccountDataRecord
}) {
  const { t } = useTranslation([ns])
  const { last, pending } = useLobbyHackStore(
    useShallow((state) => ({ last: state.last, pending: state.pending }))
  )
  const nameOf = (accountId: string) =>
    accountList[accountId]
      ? parseCustomDisplayName(accountList[accountId])
      : t('lobby-hacks.result.removed-account')

  if (pending) {
    return (
      <Panel
        aria-live="polite"
        role="status"
      >
        <PanelHeader
          actions={
            <StatusPill
              pulse
              tone="idle"
            >
              {t('lobby-hacks.form.submitting')}
            </StatusPill>
          }
          as="div"
          description={t('lobby-hacks.result.submitting-for')}
          title={nameOf(pending.accountId)}
        />
        <PanelBody>
          <KeyValue
            label={t('lobby-hacks.result.code')}
            value={<span className="break-all font-mono">{pending.code}</span>}
          />
        </PanelBody>
      </Panel>
    )
  }

  if (!last) {
    return null
  }

  return (
    <SubmissionResult
      accountName={nameOf(last.accountId)}
      submission={last}
    />
  )
}

export function SubmissionResult({
  accountName,
  submission,
}: {
  accountName: string
  submission: LobbyHackSubmission
}) {
  const { t } = useTranslation([ns])
  const navigate = useNavigate()
  const { result } = submission
  const outcome = `lobby-hacks.outcomes.${result.outcome}`
  const epicReply = [result.errorCode, result.errorMessage]
    .filter(Boolean)
    .join(' · ')

  return (
    <Panel aria-live="polite">
      <PanelHeader
        actions={
          <Chip tone={outcomeChipTone(result.outcome)}>
            {t(`${outcome}.label`)}
          </Chip>
        }
        as="div"
        description={
          <span className="break-all font-mono">{submission.code}</span>
        }
        title={accountName}
      />

      <PanelBody className="space-y-4">
        <Callout
          title={t(`${outcome}.title`)}
          tone={outcomeTone(result.outcome)}
        >
          <p>{t(`${outcome}.body`)}</p>
          {result.retryAfterSeconds !== null && (
            <p>
              {t('lobby-hacks.result.retry-after', {
                seconds: result.retryAfterSeconds,
              })}
            </p>
          )}
          {mayHaveGoneThrough(result.outcome) && (
            <p>{t('lobby-hacks.result.check-first')}</p>
          )}
          {result.canRepeat === true && (
            <p>{t('lobby-hacks.result.can-repeat')}</p>
          )}
          {result.outcome === 'auth-failed' && (
            <Button
              className="mt-3"
              onClick={() =>
                void navigate({
                  params: { type: 'quick-login' },
                  to: '/accounts/add/$type',
                })
              }
              size="sm"
            >
              {t('lobby-hacks.result.sign-in')}
            </Button>
          )}
        </Callout>

        {epicReply && (
          <KeyValue
            label={t('lobby-hacks.result.epic-said')}
            value={
              <span className="break-words font-mono text-xs">
                {result.httpStatus !== null && `HTTP ${result.httpStatus} · `}
                {epicReply}
              </span>
            }
          />
        )}
      </PanelBody>

      {result.rewards.length > 0 && (
        <>
          <PanelSectionHeader title={t('lobby-hacks.result.rewards')} />
          <ul className="divide-y divide-border/30 px-4 py-1">
            {result.rewards.map((reward, index) => (
              <ListRow
                caption={<span className="font-mono">{reward.itemType}</span>}
                figure={
                  reward.quantity !== null && reward.quantity !== 1
                    ? `×${numberWithCommaSeparator(reward.quantity)}`
                    : undefined
                }
                key={`${reward.itemType}-${index}`}
                name={reward.name}
                well={
                  reward.imageUrl ? (
                    <IconWell size="sm">
                      <img
                        alt=""
                        className="size-full object-contain"
                        loading="lazy"
                        src={reward.imageUrl}
                      />
                    </IconWell>
                  ) : (
                    <IconWell
                      icon={Gift}
                      size="sm"
                    />
                  )
                }
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

const categoryIcons = {
  sprite: Sparkles,
  'sprite-dust': Sparkles,
  xp: Zap,
  gizmo: Package,
  cosmetic: Shirt,
  'lobby-effect': Clapperboard,
  expired: Gift,
} as const

/**
 * Every known code for the season, grouped by what it gives. Reward codes
 * are buttons that put the code in the form; lobby effects and expired
 * codes are listed for reference only, since sending them from here does
 * nothing.
 */
export function KnownCodesPanel({ pickable }: { pickable: boolean }) {
  const { t } = useTranslation([ns])
  const [query, setQuery] = useState('')
  const groups = groupLobbyHackCodes(query)

  const pick = (code: string) => {
    setLobbyHackDraft({ code })
    document.getElementById(codeFieldId)?.focus()
  }

  return (
    <Panel>
      <PanelHeader
        description={t('lobby-hacks.codes.description', {
          count: knownLobbyHackCodes.length,
          date: dayjs(lobbyHackCodesCheckedAt).format('D MMMM YYYY'),
        })}
        title={t('lobby-hacks.codes.title')}
      />
      <FilterBar>
        <SearchField
          label={t('lobby-hacks.codes.search')}
          onChange={setQuery}
          placeholder={t('lobby-hacks.codes.search-placeholder')}
          value={query}
        />
      </FilterBar>

      {groups.length === 0 ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          title={t('lobby-hacks.codes.empty')}
        />
      ) : (
        groups.map((group) => (
          <CodeGroup
            group={group}
            key={group.key}
            onPick={pickable ? pick : undefined}
          />
        ))
      )}
    </Panel>
  )
}

function CodeGroup({
  group,
  onPick,
}: {
  group: LobbyHackCodeGroup
  onPick?: (code: string) => void
}) {
  const { t } = useTranslation([ns])
  const Icon = categoryIcons[group.key]

  return (
    <section>
      <PanelSectionHeader
        actions={
          <span className="figure text-xs text-muted-foreground">
            {group.codes.length}
          </span>
        }
        title={t(`lobby-hacks.codes.categories.${group.key}`)}
      />
      <ul className="grid gap-x-6 px-4 py-1 sm:grid-cols-2 xl:grid-cols-3">
        {group.codes.map((entry) => (
          <ListRow
            caption={[entry.reward, entry.requires ?? entry.note]
              .filter(Boolean)
              .join(' · ')}
            key={entry.code}
            name={<span className="font-mono">{entry.code}</span>}
            onClick={
              onPick && isSubmittableCode(entry)
                ? () => onPick(entry.code)
                : undefined
            }
            well={
              <IconWell
                icon={Icon}
                size="sm"
              />
            }
          />
        ))}
      </ul>
    </section>
  )
}
