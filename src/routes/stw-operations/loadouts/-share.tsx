
import { Copy, Download, Image as ImageIcon, Share2 } from 'lucide-react'
import type { ReactElement } from 'react'

import { useState } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { Button } from '../../../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu'

import { toast } from '../../../lib/notifications'

/**
 * The game-style share card as a PNG. It is mounted off-screen for the
 * moment it takes to capture — after its art has loaded, so no portrait
 * comes out blank — and removed again.
 */
async function captureCard(card: ReactElement) {
  const host = document.createElement('div')

  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;'
  document.body.appendChild(host)

  const root = createRoot(host)

  try {
    flushSync(() => root.render(card))

    const images = [...host.querySelectorAll('img')]

    /* Lazy art never loads this far off-screen, so ask for all of it now. */
    for (const image of images) image.loading = 'eager'

    /* Art that is slow to arrive is left out rather than holding the image up. */
    await Promise.race([
      Promise.all(
        images.map((image) =>
          image.complete ? Promise.resolve() : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true })
            image.addEventListener('error', resolve, { once: true })
          })
        )
      ),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ])

    const { domToBlob } = await import('modern-screenshot')

    return await domToBlob(host.firstElementChild as HTMLElement, { scale: 2, timeout: 15_000, type: 'image/png' })
  } finally {
    root.unmount()
    host.remove()
  }
}

export function ShareMenu({
  card,
  fileName,
  onCopyToAccount,
}: {
  /** The image to make — built on demand. */
  card: () => ReactElement
  /** Without extension. */
  fileName: string
  /** Opens the copy-to-account dialog for this loadout. */
  onCopyToAccount: () => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async (
    label: string,
    action: () => Promise<void>,
    failure = 'Could not make the image. Try again once the art has loaded.'
  ) => {
    if (busy) return

    setBusy(true)
    try {
      await action()
      toast.success(label)
    } catch {
      toast.error(failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Share this loadout"
          className="size-7 p-0"
          data-share-hide
          disabled={busy}
          size="sm"
          title="Share this loadout"
          variant="ghost"
        >
          <Share2 className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onSelect={() =>
            run('Loadout image copied', async () => {
              const blob = await captureCard(card())
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
            })
          }
        >
          <ImageIcon className="mr-2 size-3.5" />
          Copy image
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            run('Loadout image saved', async () => {
              const blob = await captureCard(card())
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')

              link.href = url
              link.download = `${fileName}.png`
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            })
          }
        >
          <Download className="mr-2 size-3.5" />
          Save image…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyToAccount}>
          <Copy className="mr-2 size-3.5" />
          Copy to another account…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
