import type { Rewind } from './model'
import type { Slide } from './slides'

import { AnimatedNumber } from '../../components/page'

import { seasonName } from './facts'
import { Aside, Bars, Big, CosmeticTile, Figures, Kicker, Line, TierChip, Title } from './parts'
import { formatCount, formatHours, formatPercent } from './words'

import { cn } from '../../lib/utils'

/**
 * Part two of the Rewind: Battle Royale. Fortnite's own career stats on
 * every platform, the season log and the lockers — over the island's map,
 * with one of the player's own outfits standing in front.
 */

function decimal(value: number, digits = 1) {
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function battleRoyaleSlides(rewind: Rewind): Array<Slide> {
  const list: Array<Slide> = []
  const br = rewind.battleRoyale
  const seasons = rewind.seasons
  const cosmetics = rewind.cosmetics
  const renders = cosmetics?.renders ?? []
  let next = 0
  /** A different outfit for each slide, round and round. */
  const render = () => (renders.length > 0 ? renders[next++ % renders.length] : null)

  if (br && br.matches > 0) {
    list.push({
      key: 'battle-royale',
      stage: { kind: 'br', render: render() },
      body: (
        <>
          <Kicker>Part 2 · Battle Royale</Kicker>
          <Figures
            items={[
              { label: 'Victory Royales', value: <AnimatedNumber value={br.wins} /> },
              { label: 'Eliminations', value: <AnimatedNumber value={br.kills} /> },
              { label: 'Matches', value: <AnimatedNumber value={br.matches} /> },
            ]}
            size="hero"
          />
          <Line>
            {[
              br.winEvery ? `A win every ${formatCount(br.winEvery)} matches` : null,
              br.killsPerMatch !== null ? `${decimal(br.killsPerMatch)} eliminations a match` : null,
              br.kd !== null ? `K/D ${decimal(br.kd, 2)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Line>
          {br.squads.length > 0 && (
            <ul className="flex flex-wrap gap-3 pt-1">
              {br.squads.map((squad) => (
                <li className="min-w-32 rounded-lg bg-foreground/10 px-4 py-3 backdrop-blur-sm" key={squad.size}>
                  <p className="micro-label">{squad.label}</p>
                  <p className="figure mt-1 text-display-sm font-bold leading-none">{formatCount(squad.wins)} wins</p>
                  <p className="mt-1 text-xs text-foreground/70">
                    {formatCount(squad.matches)} matches · {formatCount(squad.kills)} elims
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    })
  }

  if (br && br.modes.length > 1) {
    list.push({
      key: 'modes',
      stage: { kind: 'br', render: render() },
      body: (
        <>
          <Kicker>Where you play</Kicker>
          <Title>{br.modes[0].label}</Title>
          <Line>is home: {formatHours(br.modes[0].hours)} hours of it.</Line>
          <Bars rows={br.modes.slice(0, 6).map((mode) => ({ key: mode.label, label: mode.label, value: mode.hours, figure: `${formatHours(mode.hours)} h` }))} />
        </>
      ),
    })
  }

  if (rewind.input) {
    list.push({
      key: 'input',
      stage: { kind: 'br', render: render() },
      body: (
        <>
          <Kicker>How you play</Kicker>
          <Big>{formatPercent(rewind.input.share)}</Big>
          <Line>of your Battle Royale and island time on {rewind.input.label.toLowerCase()}.</Line>
          {rewind.input.share >= 90 && (
            <Aside>A {rewind.input.label.toLowerCase()} player through and through.</Aside>
          )}
        </>
      ),
    })
  }

  if (br && br.outlived > 0) {
    list.push({
      key: 'outlived',
      stage: { kind: 'br', render: render() },
      body: (
        <>
          <Kicker>Still standing</Kicker>
          <Line>You've outlived</Line>
          <Big>
            <AnimatedNumber value={br.outlived} />
          </Big>
          <Line>players along the way.</Line>
        </>
      ),
    })
  }

  if (seasons && seasons.timeline.length > 0) {
    const highest = Math.max(...seasons.timeline.map((season) => season.level), 1)

    list.push({
      key: 'seasons',
      stage: { kind: 'br', render: render() },
      body: (
        <>
          <Kicker>Season by season</Kicker>
          <Big>{seasons.timeline.length}</Big>
          <Line>
            seasons{seasons.first ? `, starting in ${seasonName(seasons.first)}` : ''} · {formatCount(seasons.battlePasses)} Battle Passes
            {seasons.otherPasses > 0 ? ` and ${formatCount(seasons.otherPasses)} more passes` : ''}.
          </Line>
          <div aria-hidden className="mt-2 flex h-36 max-w-3xl items-end gap-1">
            {seasons.timeline.map((season) => (
              <span
                className={cn(
                  'flex-1 rounded-t-sm',
                  season.battlePass ? 'bg-primary' : 'bg-foreground/25',
                  seasons.best?.season === season.season && 'ring-2 ring-foreground'
                )}
                key={season.season}
                style={{ height: `${Math.max(4, (season.level / highest) * 100)}%` }}
                title={`${seasonName(season.season)} · level ${season.level}`}
              />
            ))}
          </div>
          <p className="flex max-w-3xl justify-between gap-4 text-xs text-foreground/70">
            <span>{seasonName(seasons.timeline[0].season)}</span>
            <span>Each bar is a season at its best level{seasons.battlePasses > 0 ? ', coloured where a Battle Pass was bought' : ''}</span>
            <span>{seasonName(seasons.timeline[seasons.timeline.length - 1].season)}</span>
          </p>
          {seasons.best && (
            <Line className="text-title">
              Your best: {seasonName(seasons.best.season)}, level {formatCount(seasons.best.level)} on {seasons.best.name}
              {seasons.crowns > 0 ? ` · ${formatCount(seasons.crowns)} crowned wins` : ''}
              {seasons.accountLevel ? ` · account level ${formatCount(seasons.accountLevel.level)}` : ''}.
            </Line>
          )}
        </>
      ),
    })
  }

  if (cosmetics && cosmetics.oldest.length > 0) {
    const earliest = cosmetics.oldest[0].introduced ?? 99

    list.push({
      key: 'og',
      stage: { kind: 'br', render: cosmetics.oldest.find((item) => item.featured) ?? render() },
      body: (
        <>
          <Kicker>The OG collection</Kicker>
          <Title>{earliest <= 2 ? 'You were there early.' : 'Your oldest outfits'}</Title>
          <div className="flex max-w-3xl flex-wrap gap-4 pt-2">
            {cosmetics.oldest.slice(0, 6).map((item) => (
              <CosmeticTile item={item} key={item.id} />
            ))}
          </div>
          {cosmetics.chapterOne > 0 && (
            <Aside>{formatCount(cosmetics.chapterOne)} Chapter 1 outfits across your lockers.</Aside>
          )}
        </>
      ),
    })
  }

  if (cosmetics && cosmetics.favourites.length > 0) {
    list.push({
      key: 'favourites',
      stage: { kind: 'br', render: cosmetics.favourites.find((item) => item.featured) ?? render() },
      body: (
        <>
          <Kicker>Your favourites</Kicker>
          <Title>The ones you starred.</Title>
          <div className="grid max-w-3xl grid-cols-[repeat(auto-fill,7rem)] gap-4 pt-2">
            {cosmetics.favourites.slice(0, 10).map((item) => (
              <CosmeticTile caption={item.series ?? undefined} item={item} key={item.id} />
            ))}
          </div>
          {cosmetics.favouriteCount > cosmetics.favourites.length && (
            <Aside>{formatCount(cosmetics.favouriteCount)} favourites in all, outfits first.</Aside>
          )}
        </>
      ),
    })
  }

  if (rewind.locker && rewind.locker.total > 0) {
    const locker = rewind.locker

    list.push({
      key: 'locker',
      stage: { kind: 'br', render: cosmetics?.rarest.find((item) => item.featured) ?? render() },
      body: (
        <>
          <Kicker>The locker</Kicker>
          <Big>
            <AnimatedNumber value={locker.total} />
          </Big>
          <Line>cosmetics across your lockers.</Line>
          <Figures
            items={[
              { label: 'Outfits', value: formatCount(locker.outfits) },
              { label: 'Back Blings', value: formatCount(locker.backBlings) },
              { label: 'Pickaxes', value: formatCount(locker.pickaxes) },
              { label: 'Gliders', value: formatCount(locker.gliders) },
              { label: 'Emotes and sprays', value: formatCount(locker.emotes) },
              { label: 'Wraps', value: formatCount(locker.wraps) },
            ]}
          />
          {cosmetics && cosmetics.byRarity.length > 0 && (
            <div className="flex max-w-3xl flex-wrap gap-2 pt-1">
              {cosmetics.byRarity.slice(0, 8).map((tier) => (
                <TierChip count={tier.count} key={tier.rarity} label={tier.label} rarity={tier.rarity} />
              ))}
            </div>
          )}
          {cosmetics && cosmetics.rarest.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {cosmetics.rarest.slice(0, 6).map((item) => (
                <CosmeticTile item={item} key={item.id} size="sm" />
              ))}
            </div>
          )}
        </>
      ),
    })
  }

  return list
}
