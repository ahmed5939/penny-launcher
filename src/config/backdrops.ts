import type { ColorTheme } from './constants/color-themes'

import commandCenter from '../../assets/images/backdrops/command-center.webp'
import commandCenterDark from '../../assets/images/backdrops/command-center-dark.webp'
import defenseFort from '../../assets/images/backdrops/defense-fort.webp'
import dungeonsGrotto from '../../assets/images/backdrops/event-dungeons-grotto.webp'
import dungeonsLabyrinth from '../../assets/images/backdrops/event-dungeons-labyrinth.webp'
import frostnite from '../../assets/images/backdrops/event-frostnite.webp'
import hitTheRoad from '../../assets/images/backdrops/event-hit-the-road.webp'
import surviveTheHorde from '../../assets/images/backdrops/event-survive-the-horde.webp'
import harbor from '../../assets/images/backdrops/harbor.webp'
import heroLineup from '../../assets/images/backdrops/hero-lineup.webp'
import homebaseNight from '../../assets/images/backdrops/homebase-night.webp'
import huskHorde from '../../assets/images/backdrops/husk-horde.webp'
import industrialYard from '../../assets/images/backdrops/industrial-yard.webp'
import cloakedStar from '../../assets/images/backdrops/key-cloaked-star.webp'
import hordeBash from '../../assets/images/backdrops/key-horde-bash.webp'
import hordeFight from '../../assets/images/backdrops/key-horde-fight.webp'
import jess from '../../assets/images/backdrops/key-jess.webp'
import route99 from '../../assets/images/backdrops/key-route-99.webp'
import stormKing from '../../assets/images/backdrops/key-storm-king.webp'
import stormWarning from '../../assets/images/backdrops/key-storm-warning.webp'
import lab from '../../assets/images/backdrops/lab.webp'
import llama from '../../assets/images/backdrops/llama.webp'
import lobbyWinter from '../../assets/images/backdrops/lobby-winter.webp'
import plankerton from '../../assets/images/backdrops/plankerton-grove.webp'
import rayLab from '../../assets/images/backdrops/ray-lab.webp'
import canny from '../../assets/images/backdrops/canny-storm.webp'
import cannyBeams from '../../assets/images/backdrops/canny-beams.webp'
import twineBlast from '../../assets/images/backdrops/twine-blast.webp'
import blastedBadlands from '../../assets/images/backdrops/season-blasted-badlands.webp'
import flannelFalls from '../../assets/images/backdrops/season-flannel-falls.webp'
import frozenFjords from '../../assets/images/backdrops/season-frozen-fjords.webp'
import hexsylvania from '../../assets/images/backdrops/season-hexsylvania.webp'
import mildMeadows from '../../assets/images/backdrops/season-mild-meadows.webp'
import scurvyShoals from '../../assets/images/backdrops/season-scurvy-shoals.webp'
import stonewood from '../../assets/images/backdrops/stonewood-camp.webp'
import storm from '../../assets/images/backdrops/storm.webp'
import squadLeads from '../../assets/images/backdrops/squad-leads.webp'
import stormMission from '../../assets/images/backdrops/storm-mission.webp'
import survivorCrowd from '../../assets/images/backdrops/survivor-crowd.webp'
import tropicalTemple from '../../assets/images/backdrops/tropical-temple.webp'
import vault from '../../assets/images/backdrops/vault.webp'

/**
 * Save the World key art and in-game screenshots (1920px webp, from the
 * community "STW Asset Pack"). `position` is the CSS object-position that
 * keeps the subject in frame when the art is cropped to a wide strip;
 * `opacity` turns down shots bright enough to fight the text over them.
 */
export type Backdrop = { opacity?: number; position: string; src: string }

const art = (src: string, position = 'center 40%', opacity?: number): Backdrop => ({ opacity, position, src })

/** Home's hero, by colour theme: the zone the theme is named after. */
const themeBackdrops: Record<ColorTheme, Backdrop> = {
  penny: art(stormWarning, 'center 30%'),
  stonewood: art(stonewood, 'center 55%'),
  plankerton: art(plankerton, 'center 45%'),
  canny: art(route99, 'center 55%'),
  twine: art(stormKing, 'center 12%'),
  ventures: art(frozenFjords, 'center 60%'),
}

/** What Home's hero can be set to instead, in Settings → Appearance. */
export const homeArtOptions = {
  'horde-fight': { label: 'Storm Warning', backdrop: art(hordeFight, 'center 35%') },
  'husk-horde': { label: 'The husk horde', backdrop: art(huskHorde, 'center 30%') },
  'storm-king': { label: 'Storm King', backdrop: art(stormKing, 'center 12%') },
  'horde-bash': { label: 'Horde Bash', backdrop: art(hordeBash, 'center 35%') },
  'team': { label: 'The squad', backdrop: art(stormWarning, 'center 30%') },
  'cloaked-star': { label: 'Cloaked Star', backdrop: art(cloakedStar, 'center 30%') },
  'route-99': { label: 'Route 99', backdrop: art(route99, 'center 55%') },
  'homebase': { label: 'Homebase at night', backdrop: art(homebaseNight, 'center 50%') },
  'frozen-fjords': { label: 'Frozen Fjords', backdrop: art(frozenFjords, 'center 60%') },
} satisfies Record<string, { backdrop: Backdrop; label: string }>

export type HomeArt = keyof typeof homeArtOptions

export function homeBackdrop(colorTheme: ColorTheme, choice: HomeArt | 'theme'): Backdrop {
  return choice !== 'theme' && choice in homeArtOptions
    ? homeArtOptions[choice].backdrop
    : themeBackdrops[colorTheme]
}

/**
 * Each Ventures season's zone, by the season's name as Epic and the Bug List
 * spell it. Ventures shows the account's season; Timeline falls back to it.
 */
const seasonBackdrops: Record<string, Backdrop> = {
  'blasted badlands': art(blastedBadlands, 'center 45%'),
  'flannel falls': art(flannelFalls, 'center 40%'),
  'frozen fjords': art(frozenFjords, 'center 60%'),
  'hexsylvania': art(hexsylvania, 'center 50%'),
  'hexylvania': art(hexsylvania, 'center 50%'),
  'mild meadows': art(mildMeadows, 'center 45%'),
  'scurvy shoals': art(scurvyShoals, 'center 55%'),
}

export function seasonBackdrop(name: string | null | undefined): Backdrop | null {
  return name ? seasonBackdrops[name.trim().toLowerCase()] ?? null : null
}

/**
 * Each season's event mode, for Timeline. Dungeons ran twice, so the season
 * picks the dungeon: Flannel Falls' tropical grotto, Hexsylvania's haunted
 * labyrinth.
 */
const eventBackdrops: Record<string, Backdrop> = {
  'dungeons': art(dungeonsLabyrinth, 'center 50%'),
  'dungeons/flannel falls': art(dungeonsGrotto, 'center 50%'),
  'frostnite': art(frostnite, 'center 55%'),
  'hit the road': art(hitTheRoad, 'center 60%'),
  'survive the horde': art(surviveTheHorde, 'center 50%'),
}

export function eventBackdrop(eventMode: string | null | undefined, seasonName?: string | null): Backdrop | null {
  if (!eventMode) return null

  const event = eventMode.trim().toLowerCase()
  const season = seasonName?.trim().toLowerCase()

  return (season && eventBackdrops[`${event}/${season}`]) || eventBackdrops[event] || null
}

/**
 * Inner pages, by route prefix: each shows the thing the page manages as it
 * looks in the game. The first match wins, so list the more specific paths
 * first. Routes not listed get no art.
 */
const routeBackdrops: Array<[prefix: string, backdrop: Backdrop]> = [
  // A Twine Peaks mission under the storm, lightning and all.
  ['/stw-operations/missions', art(stormMission, 'center 45%')],
  ['/stw-operations/expeditions', art(harbor, 'center 55%')],
  ['/stw-operations/outpost', art(homebaseNight, 'center 50%')],
  ['/stw-operations/heroes', art(heroLineup, 'center 25%', 0.4)],
  ['/stw-operations/profile', art(cloakedStar, 'center 30%')],
  // The game's own survivor portraits: a crowd of them, and one lead per squad.
  ['/stw-operations/survivors', art(survivorCrowd, 'center 55%')],
  ['/stw-operations/squads', art(squadLeads, 'center 55%')],
  ['/stw-operations/defenders', art(defenseFort, 'center 45%')],
  ['/stw-operations/loadouts', art(commandCenter, 'center 55%')],
  // Weapons and traps, fired in anger.
  ['/stw-operations/schematics', art(hordeBash, 'center 35%')],
  ['/stw-operations/backpack', art(vault, 'center 70%')],
  ['/stw-operations/collection-book', art(commandCenterDark, 'center 60%')],
  ['/stw-operations/rare-item-finder', art(cannyBeams, 'center 45%')],
  ['/stw-operations/codex', art(hordeFight, 'center 40%')],
  ['/stw-operations/auto-llamas', art(llama, 'center 72%')],
  ['/stw-operations/shop', art(llama, 'center 72%')],
  ['/stw-operations/recycled-rewards', art(industrialYard, 'center 60%')],
  // Quests come from Ray, in the command centre.
  ['/stw-operations/auto-daily-reroll', art(rayLab, 'center 45%')],
  ['/stw-operations/urns', art(rayLab, 'center 45%')],
  ['/stw-operations/quests', art(rayLab, 'center 45%')],
  ['/stw-operations/automation', art(lab, 'center 50%')],
  // Until the page knows its season; see `seasonBackdrop`.
  ['/stw-operations/timeline', art(frozenFjords, 'center 60%')],
  ['/stw-operations/ventures', art(frozenFjords, 'center 60%')],
  ['/stw-operations/xpboosts', art(huskHorde, 'center 35%')],
  ['/stw-operations/leaderboards', art(stormKing, 'center 15%')],
  ['/advanced-mode/world-info', art(canny, 'center 45%')],
  ['/advanced-mode/matchmaking-track', art(twineBlast, 'center 45%')],
  ['/advanced-mode', art(commandCenterDark, 'center 60%')],
  ['/account-management/friends', art(lobbyWinter, 'center 50%')],
  ['/account-management/locker', art(jess, 'center 30%')],
  ['/account-management/sprites', art(tropicalTemple, 'center 45%')],
  ['/account-management/vbucks-information', art(vault, 'center 70%')],
  ['/account-management/gifts-information', art(vault, 'center 70%')],
  ['/account-management/redeem-codes', art(vault, 'center 70%')],
  ['/account-management', art(commandCenter, 'center 55%')],
  ['/accounts', art(commandCenter, 'center 55%')],
  ['/account', art(commandCenter, 'center 55%')],
  ['/plugins', art(storm, 'center 50%')],
  ['/settings', art(storm, 'center 50%')],
  ['/information', art(storm, 'center 50%')],
]

export function backdropFor(pathname: string): Backdrop | null {
  if (pathname === '/') return null

  for (const [prefix, backdrop] of routeBackdrops) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return backdrop
    }
  }

  return null
}
