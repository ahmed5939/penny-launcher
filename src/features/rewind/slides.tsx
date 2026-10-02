import type { ReactNode } from 'react'
import type { CosmeticShowcase, StwShowcase } from './facts'
import type { Rewind } from './model'

import commandCenter from '../../../assets/images/backdrops/command-center-dark.webp'
import frostnite from '../../../assets/images/backdrops/event-frostnite.webp'
import heroLineup from '../../../assets/images/backdrops/hero-lineup.webp'
import stormKing from '../../../assets/images/backdrops/key-storm-king.webp'
import storm from '../../../assets/images/backdrops/storm.webp'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { AnimatedNumber } from '../../components/page'

import { sizedArt } from '../library/model'
import { Aside, Bars, Big, CosmeticTile, Kicker, Line, StwTile, Title } from './parts'
import { battleRoyaleSlides } from './slides-br'
import { saveTheWorldSlides } from './slides-stw'
import { formatCount, formatHours, formatPower, sinceMonth } from './words'

/**
 * The Rewind's slides, in the order they play: Save the World first, then
 * Battle Royale, then everything together. A slide whose facts are missing
 * is skipped, never shown empty.
 */

export type Stage =
  | { kind: 'art'; src: string }
  | { kind: 'stw'; src: string; hero: StwShowcase | null }
  | { kind: 'br'; render: CosmeticShowcase | null }

export type Slide = { key: string; stage: Stage; body: ReactNode }

export function rewindSlides(rewind: Rewind): Array<Slide> {
  const list: Array<Slide> = []
  const faces = rewind.perAccount.filter((account) => account.commander || account.signature)

  list.push({
    key: 'intro',
    stage: { kind: 'art', src: stormKing },
    body: (
      <>
        <Kicker>Penny Rewind</Kicker>
        <Title>{rewind.command ? 'Ready, Commander? Let\'s rewind.' : 'Ready? Let\'s rewind your Fortnite.'}</Title>
        <Line>
          {rewind.accounts === 1 ? 'One account' : `${rewind.accounts} accounts`}
          {rewind.since ? `, playing since ${sinceMonth(rewind.since.at)}` : ''}.
        </Line>
        {faces.length > 0 && (
          <div className="flex flex-wrap gap-4 pt-2">
            {faces.map((account) =>
              account.commander ? (
                <StwTile caption={account.name} item={account.commander} key={account.id} />
              ) : (
                <CosmeticTile caption={account.name} item={account.signature!} key={account.id} />
              )
            )}
          </div>
        )}
      </>
    ),
  })

  list.push(...saveTheWorldSlides(rewind), ...battleRoyaleSlides(rewind))

  if (rewind.hours.total > 0) {
    list.push({
      key: 'hours',
      stage: { kind: 'art', src: storm },
      body: (
        <>
          <Kicker>All together</Kicker>
          <Big>
            <AnimatedNumber value={Math.round(rewind.hours.total)} />
          </Big>
          <Line>
            hours of Fortnite. That's {formatCount(Math.floor(rewind.hours.days))} days without a break
            {rewind.hours.days >= 60 ? ` — about ${formatCount(Math.round(rewind.hours.days / 30.4))} months` : ''}.
          </Line>
          <Bars
            rows={rewind.perAccount.map((account) => ({
              key: account.id,
              label: (
                <span className="flex items-center gap-2">
                  <AccountAvatar accountId={account.id} name={account.name} size="sm" />
                  <span className="truncate">{account.name}</span>
                </span>
              ),
              value: account.seconds,
              figure: `${formatHours(account.seconds / 3600)} h`,
            }))}
          />
          <Aside>
            {formatHours(rewind.hours.pc)} h on PC through Epic · {formatHours(rewind.hours.everywhere)} h of Battle Royale and islands on every platform
          </Aside>
        </>
      ),
    })
  }

  if (rewind.games.owned > 0) {
    const art = sizedArt(rewind.games.top?.art.tall ?? null, 300, 400)

    list.push({
      key: 'games',
      stage: { kind: 'art', src: commandCenter },
      body: (
        <div className="flex flex-wrap items-end gap-10">
          <div className="space-y-4">
            <Kicker>Beyond Fortnite</Kicker>
            <Big>{formatCount(rewind.games.owned)}</Big>
            <Line>more {rewind.games.owned === 1 ? 'game' : 'games'} in your Epic libraries.</Line>
            {rewind.games.achievements.unlocked > 0 && (
              <Line className="text-title">
                {formatCount(rewind.games.achievements.unlocked)} achievements · {formatCount(rewind.games.achievements.xp)} XP
              </Line>
            )}
          </div>
          {rewind.games.top && (
            <figure className="w-40">
              {art && <img alt="" className="aspect-[3/4] w-full rounded-lg object-cover shadow-lg" src={art} />}
              <figcaption className="mt-2 text-ui">
                <span className="block font-semibold">{rewind.games.top.title}</span>
                <span className="figure text-foreground/70">{formatHours(rewind.games.top.hours)} h, your most played</span>
              </figcaption>
            </figure>
          )}
        </div>
      ),
    })
  }

  if (rewind.gifts && rewind.gifts.sent + rewind.gifts.received > 0) {
    const gifts = rewind.gifts

    list.push({
      key: 'gifts',
      stage: { kind: 'art', src: frostnite },
      body: (
        <>
          <Kicker>Generosity</Kicker>
          <Line>You've sent</Line>
          <Big>
            <AnimatedNumber value={gifts.sent} />
          </Big>
          <Line>
            gifts, and received {formatCount(gifts.received)}. {gifts.sent >= gifts.received ? 'Generous.' : 'Well loved.'}
          </Line>
        </>
      ),
    })
  }

  const top = rewind.perAccount[0]

  if (rewind.accounts > 1 && top) {
    list.push({
      key: 'lineup',
      stage: { kind: 'art', src: heroLineup },
      body: (
        <>
          <Kicker>Your squad</Kicker>
          <Title>{top.name} carries.</Title>
          <ol className="mt-2 flex max-w-5xl flex-wrap gap-5">
            {rewind.perAccount.map((account, index) => (
              <li className="w-80 rounded-xl bg-foreground/10 p-4 backdrop-blur-sm" key={account.id}>
                <div className="flex items-center gap-3">
                  {account.commander ? (
                    <StwTile item={account.commander} size="sm" />
                  ) : account.signature ? (
                    <CosmeticTile item={account.signature} size="sm" />
                  ) : (
                    <AccountAvatar accountId={account.id} name={account.name} size="lg" />
                  )}
                  <div className="min-w-0">
                    <p className="figure text-xs text-foreground/60">#{index + 1}</p>
                    <p className="truncate text-title font-bold">{account.name}</p>
                    {account.saveTheWorld && <p className="truncate text-xs text-success">{account.saveTheWorld}</p>}
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2">
                  {[
                    ['Power', account.power !== null ? formatPower(account.power) : '—'],
                    ['Hours', formatHours(account.seconds / 3600)],
                    ['Wins', formatCount(account.wins)],
                    ['Elims', formatCount(account.kills)],
                  ].map(([label, value]) => (
                    <div className="flex min-w-0 flex-col-reverse" key={label}>
                      <dt className="micro-label">{label}</dt>
                      <dd className="figure truncate text-title font-bold">{value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </>
      ),
    })
  }

  return list
}
