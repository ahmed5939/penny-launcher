import type { Rewind } from './model'

import { forwardRef } from 'react'

import backdrop from '../../../assets/images/backdrops/key-cloaked-star.webp'

import { CosmeticTile, StwTile } from './parts'
import { formatCount, formatHours, formatPower, sinceYear } from './words'

/**
 * The Rewind as one shareable picture: bundled art behind, the figures —
 * Save the World's first — and a strip of commanders and favourite outfits
 * (PegLeg and fortnite-api serve their art with open CORS, so it exports).
 * 540 × 675, exported at twice that.
 */
export const RewindPoster = forwardRef<HTMLDivElement, { rewind: Rewind }>(function RewindPoster({ rewind }, ref) {
  const br = rewind.battleRoyale
  const founders = rewind.saveTheWorld.founders
  const command = rewind.command
  const commanders = rewind.perAccount.flatMap((account) => (account.commander?.image ? [account.commander] : [])).slice(0, 3)
  const outfits = (rewind.cosmetics?.favourites.length ? rewind.cosmetics.favourites : rewind.cosmetics?.rarest ?? []).slice(0, 5 - commanders.length)
  const figures = [
    command?.power ? { label: 'Power', value: formatPower(command.power.value) } : null,
    rewind.grind ? { label: 'STW missions', value: formatCount(rewind.grind.missions) } : null,
    command?.mythics.length ? { label: 'Mythics', value: formatCount(command.mythics.length) } : null,
    br ? { label: 'Wins', value: formatCount(br.wins) } : null,
    br ? { label: 'Eliminations', value: formatCount(br.kills) } : null,
    rewind.locker ? { label: 'Cosmetics', value: formatCount(rewind.locker.total) } : null,
    rewind.seasons ? { label: 'Battle Passes', value: formatCount(rewind.seasons.battlePasses) } : null,
    br ? { label: 'Matches', value: formatCount(br.matches) } : { label: 'Epic games', value: formatCount(rewind.games.owned) },
  ]
    .filter((figure): figure is { label: string; value: string } => figure !== null)
    .slice(0, 6)

  return (
    <div className="relative h-[675px] w-[540px] overflow-hidden bg-background text-foreground" ref={ref}>
      <img alt="" className="absolute inset-0 size-full object-cover opacity-70" src={backdrop} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      <div className="relative flex h-full flex-col justify-between p-10">
        <div>
          <p className="micro-label text-primary">Penny Rewind</p>
          <p className="mt-2 text-display font-bold leading-tight">
            {rewind.accounts === 1 ? 'One account' : `${rewind.accounts} accounts`}
            {rewind.since ? `, since ${sinceYear(rewind.since.at)}` : ''}
          </p>
          <p className="mt-1 text-ui font-semibold text-success">
            {founders.length > 0
              ? `${founders.length === 1 ? `${founders[0].edition ?? ''} Founder`.trim() : `${founders.length} Founders`} · Save the World`
              : rewind.saveTheWorld.withAccess > 0
                ? `Save the World on ${rewind.saveTheWorld.withAccess} of ${rewind.accounts}`
                : 'Battle Royale through and through'}
          </p>
        </div>

        <div>
          <p className="figure text-hero-lg font-black leading-none">{formatHours(rewind.hours.total)}</p>
          <p className="mt-2 text-title font-semibold text-foreground/90">
            hours of Fortnite · {formatCount(Math.floor(rewind.hours.days))} days
          </p>
          {commanders.length + outfits.length > 0 && (
            <div className="mt-5 flex gap-2.5">
              {commanders.map((hero, index) => (
                <StwTile item={hero} key={`${hero.templateId}-${index}`} size="sm" />
              ))}
              {outfits.map((item) => (
                <CosmeticTile item={item} key={item.id} size="sm" />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <dl className="grid grid-cols-3 gap-x-5 gap-y-4">
            {figures.map((figure) => (
              <div key={figure.label}>
                <dt className="micro-label">{figure.label}</dt>
                <dd className="figure text-display-sm font-bold leading-tight">{figure.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">Made with Penny Launcher</p>
        </div>
      </div>
    </div>
  )
})
