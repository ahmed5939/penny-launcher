import type { Rewind } from './model'
import type { Slide } from './slides'

import defenseFort from '../../../assets/images/backdrops/defense-fort.webp'
import stormKing from '../../../assets/images/backdrops/key-storm-king.webp'
import stormWarning from '../../../assets/images/backdrops/key-storm-warning.webp'
import squadLeads from '../../../assets/images/backdrops/squad-leads.webp'
import stormMission from '../../../assets/images/backdrops/storm-mission.webp'
import cannyValley from '../../../assets/images/zones/canny-valley.webp'
import plankerton from '../../../assets/images/zones/plankerton.webp'
import stonewood from '../../../assets/images/zones/stonewood.webp'
import twinePeaks from '../../../assets/images/zones/twine-peaks.webp'

import { AccountAvatar } from '../../components/accounts/account-avatar'
import { AnimatedNumber } from '../../components/page'

import { commanderLevelCap } from './model'
import { Aside, Big, Figures, Kicker, Line, StwTile, Title } from './parts'
import { formatCount, formatHours, formatPower, sinceMonth } from './words'

import { cn } from '../../lib/utils'

/**
 * Part one of the Rewind: Save the World. The commanders and their Power,
 * the mythics, the Storm Shields, then the grind — on the campaign's key
 * art, with a commander standing in front where one could be pictured.
 */

const zoneArt: Record<string, string> = {
  Stonewood: stonewood,
  Plankerton: plankerton,
  'Canny Valley': cannyValley,
  'Twine Peaks': twinePeaks,
}

const mythicGroups = [
  { kind: 'hero', label: 'Heroes' },
  { kind: 'schematic', label: 'Weapons and traps' },
  { kind: 'worker', label: 'Survivors' },
  { kind: 'defender', label: 'Defenders' },
]

/** As many as fit one row of the slide. */
const mythicsPerRow = 11

export function saveTheWorldSlides(rewind: Rewind): Array<Slide> {
  const list: Array<Slide> = []
  const stw = rewind.saveTheWorld
  const command = rewind.command
  const grind = rewind.grind
  const lead = command?.commanders.find((commander) => commander.hero?.image)?.hero ?? null

  if (stw.withAccess > 0 || command) {
    const homebases = command?.commanders.flatMap((commander) => (commander.homebase ? [commander.homebase] : [])) ?? []

    list.push({
      key: 'save-the-world',
      stage: { kind: 'stw', src: stormWarning, hero: lead },
      body: (
        <>
          <Kicker>Part 1 · Save the World</Kicker>
          {stw.founders.length > 0 ? (
            <>
              <Title>{stw.founders.length === 1 ? `${stw.founders[0].edition ?? ''} Founder`.trim() : `${stw.founders.length} Founders`}</Title>
              <Line>{stw.founders.map((founder) => `${founder.name}${founder.edition ? ` (${founder.edition})` : ''}`).join(', ')}</Line>
            </>
          ) : (
            <Title>Storm defender</Title>
          )}
          <Line>
            {stw.withAccess === rewind.accounts ? 'Every account' : `${stw.withAccess} of ${rewind.accounts} accounts`} holding back the storm
            {grind?.startedAt ? `, since ${sinceMonth(grind.startedAt)}` : ''}.
          </Line>
          {homebases.length > 0 && <Line className="text-title">Homebase {homebases.join(', ')}</Line>}
          {stw.hours >= 1 && <Aside>{formatHours(stw.hours)} h on Save the World's own launcher record</Aside>}
        </>
      ),
    })
  }

  if (command && command.commanders.length > 0) {
    const everyMaxed = command.maxedLevel === command.commanders.length

    list.push({
      key: 'commanders',
      stage: { kind: 'art', src: squadLeads },
      body: (
        <>
          <Kicker>Your commanders</Kicker>
          {command.power ? (
            <>
              <Big>{formatPower(command.power.value)}</Big>
              <Line>
                Power{command.commanders.length > 1 ? `, the highest on ${command.power.name}` : ''}.
                {everyMaxed
                  ? command.commanders.length === 1
                    ? ` Commander level ${commanderLevelCap}, maxed.`
                    : ` Every one at commander level ${commanderLevelCap}.`
                  : command.level
                    ? ` Commander level ${formatCount(command.level.level)} at the top.`
                    : ''}
              </Line>
            </>
          ) : (
            <Title>Ready for duty</Title>
          )}
          <ol className="flex max-w-5xl flex-wrap gap-4 pt-2">
            {command.commanders.map((commander) => (
              <li className="w-80 rounded-xl bg-foreground/10 p-4 backdrop-blur-sm" key={commander.id}>
                <div className="flex items-center gap-3">
                  {commander.hero ? (
                    <StwTile item={commander.hero} size="sm" />
                  ) : (
                    <AccountAvatar accountId={commander.id} name={commander.name} size="lg" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-title font-bold">{commander.name}</p>
                    {commander.hero && <p className="truncate text-xs text-foreground/70">Led by {commander.hero.name}</p>}
                    <p className="figure mt-1 truncate text-ui font-semibold">
                      {[
                        commander.power !== null ? `Power ${formatPower(commander.power)}` : null,
                        commander.level !== null ? `Level ${formatCount(commander.level)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                {commander.support.length > 0 && (
                  <div className="mt-3 flex gap-1.5">
                    {commander.support.map((hero, index) => (
                      <StwTile item={hero} key={`${hero.templateId}-${index}`} size="xs" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </>
      ),
    })
  }

  if (command && command.mythics.length > 0) {
    const collection = command.collection

    list.push({
      key: 'mythics',
      stage: {
        kind: 'stw',
        src: stormKing,
        hero: command.mythics.find((item) => item.templateId.toLowerCase().startsWith('hero:') && item.image) ?? null,
      },
      body: (
        <>
          <Kicker>The mythics</Kicker>
          <Big>
            <AnimatedNumber value={command.mythics.length} />
          </Big>
          <Line>
            mythics across your accounts
            {command.stormKing > 0 ? `, ${formatCount(command.stormKing)} of them the Storm King's own weapons` : ''}.
          </Line>
          <div className="space-y-3 pt-2">
            {mythicGroups.map((group) => {
              const items = command.mythics.filter((item) => item.templateId.split(':')[0].toLowerCase() === group.kind)

              return items.length > 0 ? (
                <div key={group.kind}>
                  <p className="micro-label">
                    {group.label} · {items.length}
                  </p>
                  <ul className="mt-1.5 flex items-center gap-2">
                    {items.slice(0, mythicsPerRow).map((item) => (
                      <li key={item.templateId} title={item.name}>
                        <StwTile className="w-14" item={item} size="sm" />
                      </li>
                    ))}
                    {items.length > mythicsPerRow && (
                      <li className="figure pl-1 text-ui font-semibold text-foreground/70">+{items.length - mythicsPerRow}</li>
                    )}
                  </ul>
                </div>
              ) : null
            })}
          </div>
          <Aside>
            {formatCount(collection.heroes)} heroes · {formatCount(collection.survivors)} survivors · {formatCount(collection.schematics)} schematics ·{' '}
            {formatCount(collection.defenders)} defenders in your collections
          </Aside>
        </>
      ),
    })
  }

  if (command && command.shields.some((shield) => shield.best > 0)) {
    const allHeld = command.shields.every((shield) => shield.cleared === command.commanders.length)
    const beaten = command.shields.reduce((sum, shield) => sum + shield.best, 0)

    list.push({
      key: 'storm-shields',
      stage: { kind: 'art', src: stormMission },
      body: (
        <>
          <Kicker>Storm Shield Defenses</Kicker>
          <Title>
            {allHeld
              ? command.commanders.length === 1
                ? 'Every Storm Shield, held.'
                : 'Every Storm Shield, held on every account.'
              : `${beaten} of ${command.shields.length * 10} defenses beaten.`}
          </Title>
          <ul className="grid max-w-5xl grid-cols-2 gap-4 pt-2 xl:grid-cols-4">
            {command.shields.map((shield) => (
              <li className="relative h-40 overflow-hidden rounded-xl shadow-lg ring-1 ring-foreground/10" key={shield.zone}>
                {zoneArt[shield.zone] && <img alt="" className="absolute inset-0 size-full object-cover" src={zoneArt[shield.zone]} />}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-title font-bold">{shield.zone}</p>
                  <div aria-hidden className="mt-1.5 flex gap-1">
                    {Array.from({ length: 10 }, (_, at) => (
                      <span className={cn('h-1.5 flex-1 rounded-full', at < shield.best ? 'bg-primary' : 'bg-foreground/20')} key={at} />
                    ))}
                  </div>
                  <p className="figure mt-1.5 text-xs text-foreground/80">
                    {shield.best} of 10{shield.firstClearedAt ? ` · held since ${sinceMonth(shield.firstClearedAt)}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      ),
    })
  }

  if (grind) {
    list.push({
      key: 'grind',
      stage: { kind: 'art', src: defenseFort },
      body: (
        <>
          <Kicker>Save the World, the grind</Kicker>
          <Big>
            <AnimatedNumber value={grind.missions} />
          </Big>
          <Line>missions completed{grind.startedAt ? ` since ${sinceMonth(grind.startedAt)}` : ''}. The storm never stood a chance.</Line>
          <Figures
            items={[
              { label: 'Matches', value: formatCount(grind.matches) },
              { label: 'Llamas and card packs', value: formatCount(grind.cardPacks) },
              { label: 'Days logged in', value: formatCount(grind.daysLoggedIn) },
              { label: `Rewards past level ${commanderLevelCap}`, value: formatCount(grind.pastMaxRewards) },
            ]}
          />
          {(grind.book || grind.researchMaxed > 0) && (
            <Line className="text-title">
              {[
                grind.book ? `Collection Book level ${formatCount(grind.book.level)} on ${grind.book.name}` : null,
                grind.researchMaxed > 0
                  ? `research maxed on ${grind.researchMaxed === rewind.accounts ? 'every account' : `${grind.researchMaxed} of ${rewind.accounts}`}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              .
            </Line>
          )}
        </>
      ),
    })
  }

  return list
}
