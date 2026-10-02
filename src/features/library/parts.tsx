import type { LucideIcon } from 'lucide-react'
import type { LibraryArt } from './model'

import { useState } from 'react'
import { Package } from 'lucide-react'

import { sizedArt } from './model'

import { cn } from '../../lib/utils'

/** Small pieces every Library tab draws with. */

export function day(iso: string | null) {
  return iso
    ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null
}

/** Store art, or the slot it would fill when there is none or it fails to load. */
export function Art({
  className,
  fallback: Fallback = Package,
  src,
}: {
  className?: string
  fallback?: LucideIcon
  src: string | null
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span className={cn('grid place-items-center bg-muted/40 text-muted-foreground/60', className)}>
        <Fallback className="size-6" />
      </span>
    )
  }

  return (
    <img
      alt=""
      className={cn('object-cover', className)}
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      src={src}
    />
  )
}

export function wide(art: LibraryArt, width = 480) {
  return sizedArt(art.wide ?? art.tall, width, Math.round((width * 9) / 16))
}

export function tall(art: LibraryArt, width = 300) {
  return sizedArt(art.tall ?? art.wide, width, Math.round((width * 4) / 3))
}
