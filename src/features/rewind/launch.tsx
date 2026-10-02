import { useState } from 'react'
import { Sparkles } from 'lucide-react'

import heroLineup from '../../../assets/images/backdrops/hero-lineup.webp'

import { Panel } from '../../components/page'
import { Button } from '../../components/ui/button'

import { useGetAccounts } from '../../hooks/accounts'

import { RewindStory } from './story'

/** The way into Penny Rewind from the account hub: the squad's art and one button. */
export function RewindBanner() {
  const [open, setOpen] = useState(false)
  const { idsList } = useGetAccounts()

  if (idsList.length === 0) {
    return null
  }

  return (
    <Panel className="relative">
      <img alt="" className="absolute inset-0 size-full object-cover object-[center_35%] opacity-50" decoding="async" src={heroLineup} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-card via-card/80 to-card/10" />
      <div className="relative flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="micro-label text-primary">Penny Rewind</p>
          <p className="text-display-sm font-bold leading-tight">
            Your Fortnite{idsList.length > 1 ? `, all ${idsList.length} accounts` : ''}, rewound.
          </p>
          <p className="mt-1 text-ui text-muted-foreground">Hours, wins, Founders and games — as a story you can share.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Sparkles className="mr-2 size-4" />
          Play Rewind
        </Button>
      </div>
      {open && <RewindStory onClose={() => setOpen(false)} />}
    </Panel>
  )
}

/** A plain button for pages that have no room for the banner. */
export function RewindButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="mr-2 size-4" />
        Rewind
      </Button>
      {open && <RewindStory onClose={() => setOpen(false)} />}
    </>
  )
}
