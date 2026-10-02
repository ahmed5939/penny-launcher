import type { GameAchievementSummary } from '../playtime/achievements'
import type { AccountPlaytime } from '../playtime/model'
import type { AccountLibraryOverview, CollectionGame } from './collection'
import type { GameDetailsResult } from './game-details'
import type { LibraryArt, LibraryMode } from './model'

import { useEffect, useState } from 'react'
import { ExternalLink, Play, Star } from 'lucide-react'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { Chip, ListRow, StatRow, StatTile } from '../../components/page'
import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog'

import { useGetAccounts } from '../../hooks/accounts'

import { achievementCaption } from '../playtime/achievements'
import { AchievementsDialog } from '../playtime/achievements-dialog'
import { formatPlaytime, fortniteSeconds } from '../playtime/model'
import { founderEdition } from './account'
import { modeTimes } from './collection'
import { storePageUrl } from './free-games'
import { day, wide } from './parts'

import { toast } from '../../lib/notifications'
import { parseCustomDisplayName } from '../../lib/utils'

/** The art across the top of a dialog, with its title over it. */
function Hero({ art, description, title }: { art: LibraryArt; description: string; title: string }) {
  const src = wide(art, 1280)

  return (
    <div className="relative h-48 shrink-0 overflow-hidden bg-muted">
      {src && <img alt="" className="size-full object-cover" decoding="async" src={src} />}
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <DialogHeader className="absolute inset-x-6 bottom-4 space-y-1 text-left sm:text-left">
        <DialogTitle className="text-display-sm font-bold leading-tight">{title}</DialogTitle>
        <DialogDescription className="text-ui text-foreground/80">{description}</DialogDescription>
      </DialogHeader>
    </div>
  )
}

function play(accountId: string, island: string | null, name: string, title: string) {
  window.electronAPI.launcherStartMode(accountId, island)
  toast.info(`Starting ${title} on ${name}…`)
}

/**
 * One mode — or Fortnite itself — across every account: the time each has
 * recorded in it, Save the World's lock, and a button to start the game
 * straight into it on that account.
 */
export function ModeDialog({
  mode,
  onClose,
  overviews,
  playtime,
}: {
  /** A mode, or `null` island for Fortnite as a whole. */
  mode: LibraryMode
  onClose: () => void
  overviews: Record<string, AccountLibraryOverview | undefined>
  playtime: Record<string, AccountPlaytime | undefined>
}) {
  const { accountList, idsList } = useGetAccounts()
  const whole = mode.island === null
  const times = modeTimes(mode, idsList, playtime)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <Hero
          art={mode.art}
          description={whole ? 'Fortnite, on every linked account' : 'Start straight into it on any account'}
          title={mode.title}
        />
        <ul className="divide-y divide-border/30 px-6 pb-4 pt-2">
          {times.map(({ accountId, read, seconds }) => {
            const name = parseCustomDisplayName(accountList[accountId])
            const access = overviews[accountId]?.access ?? null
            const locked = mode.saveTheWorld && access !== null && !access.campaignAccess
            const timed = playtime[accountId]
            const everywhere = timed?.allPlatforms ? formatPlaytime(timed.allPlatforms.minutes * 60) : null
            const caption = whole
              ? [
                  timed?.status === 'ok' ? `${formatPlaytime(fortniteSeconds(timed.entries))} on PC` : null,
                  everywhere ? `${everywhere} on every platform` : null,
                ]
              : [
                  mode.saveTheWorld && access
                    ? access.campaignAccess
                      ? access.founderTier !== null
                        ? `${founderEdition(access.founderTier) ?? ''} Founder`.trim()
                        : 'Unlocked'
                      : 'Locked'
                    : null,
                  !read ? 'Time not read yet' : seconds !== null ? `${formatPlaytime(seconds)} recorded` : 'No separate record',
                ]

            return (
              <li className="flex items-center gap-3 py-3" key={accountId}>
                <AccountAvatar accountId={accountId} name={name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui font-medium">{name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{caption.filter(Boolean).join(' · ')}</span>
                </span>
                {locked ? (
                  <Chip>Locked</Chip>
                ) : (
                  <Button size="sm" onClick={() => play(accountId, mode.island, name, mode.title)}>
                    <Play className="mr-2 size-3.5" />
                    Play
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

/**
 * A game across the accounts that own it: what players and critics think of
 * it, and each owner's hours and Epic achievements.
 */
export function GameDialog({ game, onClose }: { game: CollectionGame; onClose: () => void }) {
  const { accountList, idsList } = useGetAccounts()
  const [details, setDetails] = useState<GameDetailsResult | null>(null)
  const [achievements, setAchievements] = useState<{ accountId: string; summary: GameAchievementSummary } | null>(null)
  const owned = new Set(game.owners.map((owner) => owner.accountId))
  const without = idsList.filter((id) => !owned.has(id))

  useEffect(() => {
    let live = true

    window.electronAPI
      .requestGameDetails(game.namespace)
      .then((result) => live && setDetails(result))
      .catch(() => live && setDetails({ ok: false, error: 'Could not reach the Epic Games Store.' }))

    return () => {
      live = false
    }
  }, [game.namespace])

  const info = details?.ok ? details.data : null
  const storeUrl = storePageUrl(info?.storeSlug ?? null)

  return (
    <>
      <Dialog open={!achievements} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
          <Hero
            art={game.art}
            description={`On ${game.owners.length} of ${idsList.length} linked ${idsList.length === 1 ? 'account' : 'accounts'}`}
            title={game.title}
          />
          <div className="space-y-5 px-6 pb-6 pt-4">
            <StatRow>
              <StatTile
                hint={info && info.polls.length > 0 ? info.polls.map((poll) => poll.title).slice(0, 2).join(' · ') : 'Epic Games Store players'}
                label="Player rating"
                value={
                  !details ? '…' : info?.rating ? (
                    <span className="inline-flex items-center gap-1.5">
                      {info.rating.toFixed(1)}
                      <Star className="size-5 fill-current text-warning" />
                    </span>
                  ) : (
                    '—'
                  )
                }
              />
              <StatTile
                hint={info?.critic?.recommended != null ? `${info.critic.recommended}% of critics recommend` : 'OpenCritic'}
                label={info?.critic?.tier ? `Critics · ${info.critic.tier}` : 'Critics'}
                value={!details ? '…' : info?.critic?.score != null ? Math.round(info.critic.score) : '—'}
              />
              <StatTile
                hint={game.owners.length > 1 ? 'All owners together' : 'On PC'}
                label="Time recorded"
                value={game.seconds !== null ? formatPlaytime(game.seconds) : '—'}
              />
            </StatRow>

            <ul className="divide-y divide-border/30">
              {game.owners.map((owner) => {
                const name = parseCustomDisplayName(accountList[owner.accountId])

                return (
                  <ListRow
                    caption={[
                      owner.acquiredAt ? `Added ${day(owner.acquiredAt)}` : null,
                      owner.achievements ? achievementCaption(owner.achievements) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    figure={owner.seconds !== null ? formatPlaytime(owner.seconds) : '—'}
                    key={owner.accountId}
                    name={name}
                    onClick={owner.achievements ? () => setAchievements({ accountId: owner.accountId, summary: owner.achievements! }) : undefined}
                    well={<AccountAvatar accountId={owner.accountId} name={name} size="sm" />}
                  />
                )
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {without.length > 0 && `Not on ${without.map((id) => parseCustomDisplayName(accountList[id])).join(', ')}.`}
              </p>
              <div className="flex gap-2">
                {info?.critic?.url && (
                  <Button size="sm" variant="ghost" onClick={() => window.electronAPI.openExternalURL(info.critic!.url!)}>
                    OpenCritic
                  </Button>
                )}
                {storeUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.electronAPI.openExternalURL(storeUrl)}>
                    <ExternalLink className="mr-2 size-4" />
                    Store page
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {achievements && (
        <AchievementsDialog
          accountId={achievements.accountId}
          game={{ sandboxId: achievements.summary.sandboxId, title: game.title, art: game.art.wide ? game.art : achievements.summary.art }}
          onClose={() => setAchievements(null)}
        />
      )}
    </>
  )
}
