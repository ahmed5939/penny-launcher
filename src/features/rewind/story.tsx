import type { Stage } from './slides'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Download, Pause, Play, Sparkles } from 'lucide-react'

import cloakedStar from '../../../assets/images/backdrops/key-cloaked-star.webp'
import stormKing from '../../../assets/images/backdrops/key-storm-king.webp'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'

import { BrStage, Kicker, StwStage, brMapUrl } from './parts'
import { RewindPoster } from './poster'
import { rewindSlides } from './slides'
import { useRewind } from './use-rewind'

import { toast } from '../../lib/notifications'

/**
 * Penny Rewind, played as a story: one fact a slide — Save the World's over
 * its key art with the player's commanders, then Battle Royale's over the
 * island's map with their outfits — advancing by itself (unless paused with the button or Space, or
 * motion is reduced), with the arrows, a click on either side, or the
 * keyboard. The last slide is the poster, to save or copy.
 */

const slideMs = 7000

/** Warm the image cache so a slide's art is there when the slide is. */
function preload(urls: Array<string | null | undefined>) {
  for (const url of new Set(urls)) {
    if (url) {
      const image = new Image()

      image.crossOrigin = 'anonymous'
      image.src = url
    }
  }
}

function StageArt({ stage }: { stage: Stage }) {
  if (stage.kind === 'br') {
    return <BrStage render={stage.render} />
  }

  if (stage.kind === 'stw') {
    return <StwStage hero={stage.hero} src={stage.src} />
  }

  return (
    <>
      <img alt="" className="absolute inset-0 size-full object-cover opacity-60 animate-in fade-in-0 duration-700" key={stage.src} src={stage.src} />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/20" />
    </>
  )
}

/** The bar for one slide: empty, filling over the slide's time, or full. */
function Segment({ paused, state }: { paused: boolean; state: 'done' | 'current' | 'next' }) {
  const [filled, setFilled] = useState(false)

  useEffect(() => {
    if (state !== 'current') return
    setFilled(false)
    const frame = requestAnimationFrame(() => setFilled(true))

    return () => cancelAnimationFrame(frame)
  }, [state])

  return (
    <span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/20">
      <span
        className="block h-full rounded-full bg-foreground"
        style={{
          width: state === 'done' || (state === 'current' && filled) ? '100%' : '0%',
          transition: state === 'current' && filled && !paused ? `width ${slideMs}ms linear` : 'none',
        }}
      />
    </span>
  )
}

export function RewindStory({ onClose }: { onClose: () => void }) {
  const { answered, ready, rewind, total } = useRewind()
  const [waitedOut, setWaitedOut] = useState(false)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const poster = useRef<HTMLDivElement>(null)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // A slow or failed account should not hold the whole story back forever.
  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedOut(true), 45_000)

    return () => window.clearTimeout(timer)
  }, [])

  const show = ready || (waitedOut && answered > 0)
  const deck = show
    ? [...rewindSlides(rewind), { key: 'poster', stage: { kind: 'art', src: cloakedStar } as Stage, body: null }]
    : []

  useEffect(() => {
    if (!show) return
    preload([
      ...(rewind.command?.commanders ?? []).flatMap((commander) => [commander.hero, ...commander.support].map((hero) => hero?.image)),
      ...(rewind.command?.mythics ?? []).slice(0, 16).map((item) => item.image),
      brMapUrl,
      ...(rewind.cosmetics?.renders ?? []).map((item) => item.featured),
      ...(rewind.cosmetics?.favourites ?? []).map((item) => item.icon),
      ...(rewind.cosmetics?.oldest ?? []).map((item) => item.icon),
    ])
  }, [rewind.command, rewind.cosmetics, show])
  const last = deck.length - 1
  const go = useCallback((step: number) => setIndex((current) => Math.min(Math.max(current + step, 0), Math.max(last, 0))), [last])

  useEffect(() => {
    if (!show || paused || reducedMotion || index >= last) return
    const timer = window.setTimeout(() => go(1), slideMs)

    return () => window.clearTimeout(timer)
  }, [go, index, last, paused, reducedMotion, show])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1)
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === ' ') {
        event.preventDefault()
        setPaused((value) => !value)
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const capture = async () => {
    const node = poster.current

    if (!node) throw new Error('No poster')

    // Outfit art still on its way is left out rather than holding the image up.
    await Promise.race([
      Promise.all(
        [...node.querySelectorAll('img')].map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                image.addEventListener('load', resolve, { once: true })
                image.addEventListener('error', resolve, { once: true })
              })
        )
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])

    const { domToBlob } = await import('modern-screenshot')

    return domToBlob(node, { scale: 2, timeout: 15_000, type: 'image/png' })
  }

  const run = async (done: string, action: (blob: Blob) => Promise<void> | void) => {
    if (busy) return
    setBusy(true)
    try {
      await action(await capture())
      toast.success(done)
    } catch {
      toast.error('Could not make the image. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const slide = deck[index]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="left-0 top-0 h-screen max-h-none w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:max-w-none sm:rounded-none">
        <DialogTitle className="sr-only">Penny Rewind</DialogTitle>
        <DialogDescription className="sr-only">Your Fortnite across every linked account, as a story.</DialogDescription>

        {!show || !slide ? (
          <div className="relative grid size-full place-items-center">
            <img alt="" className="absolute inset-0 size-full object-cover opacity-30" src={stormKing} />
            <div className="relative space-y-3 text-center" role="status">
              <Sparkles className="mx-auto size-8 text-primary" />
              <p className="text-display font-bold">Rewinding…</p>
              <p className="text-ui text-muted-foreground">
                Reading {total === 1 ? 'your account' : `${total} accounts`} · {answered} of {total} done
              </p>
            </div>
          </div>
        ) : (
          <div className="relative size-full">
            <StageArt stage={slide.stage} />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />

            <div className="absolute inset-x-10 top-6 z-10 flex items-center gap-1.5 pr-10">
              {deck.map((entry, at) => (
                <Segment key={entry.key} paused={paused || reducedMotion} state={at < index ? 'done' : at === index ? 'current' : 'next'} />
              ))}
            </div>

            <div className="relative flex size-full items-center px-16 py-20">
              {slide.key === 'poster' ? (
                <div className="flex w-full flex-wrap items-center justify-center gap-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <Kicker>That's your Rewind</Kicker>
                    <p className="text-hero font-black leading-tight">Share it.</p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run('Rewind image saved', (blob) => {
                            const url = URL.createObjectURL(blob)
                            const link = document.createElement('a')

                            link.href = url
                            link.download = 'penny-rewind.png'
                            link.click()
                            setTimeout(() => URL.revokeObjectURL(url), 1000)
                          })
                        }
                      >
                        <Download className="mr-2 size-4" />
                        Save image
                      </Button>
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => run('Rewind image copied', (blob) => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]))}
                      >
                        <Copy className="mr-2 size-4" />
                        Copy image
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={() => setIndex(0)}>
                      Watch again
                    </Button>
                  </div>
                  <div className="overflow-hidden rounded-xl shadow-2xl ring-1 ring-foreground/10">
                    <RewindPoster ref={poster} rewind={rewind} />
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl space-y-5 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" key={slide.key}>
                  {slide.body}
                </div>
              )}
            </div>

            {slide.key !== 'poster' && (
              <>
                <button aria-label="Previous" className="absolute inset-y-16 left-0 w-1/4 focus-visible:outline-none" type="button" onClick={() => go(-1)} />
                <button aria-label="Next" className="absolute inset-y-16 right-0 w-1/3 focus-visible:outline-none" type="button" onClick={() => go(1)} />
              </>
            )}

            <div className="absolute bottom-6 right-10 z-10 flex items-center gap-2">
              <Button aria-label="Previous slide" disabled={index === 0} size="sm" variant="ghost" onClick={() => go(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button aria-label={paused ? 'Play' : 'Pause'} size="sm" variant="ghost" onClick={() => setPaused((value) => !value)}>
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </Button>
              <Button aria-label="Next slide" disabled={index === last} size="sm" variant="ghost" onClick={() => go(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
