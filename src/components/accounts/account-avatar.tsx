import type { ReactNode, RefObject } from 'react'

import { useEffect, useRef, useState } from 'react'

import { avatarInitials } from '../../features/account-extras/model'
import { useAccountAvatar } from '../../state/accounts/avatars'

import { cn } from '../../lib/utils'

/**
 * An account's face: the outfit it has equipped, as Epic shows it on the
 * account's profile, cut round. Until that loads — or when there is none,
 * or the image fails — the account's initials stand in, in the same circle,
 * so nothing shifts when the art arrives.
 *
 * `children` draw on top of the portrait: the wrapper is `relative` and
 * round, so a badge is an absolutely-positioned child in a corner.
 */

export type AccountAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AccountAvatarSize, { box: string; text: string; letters: 1 | 2 }> = {
  /** 20px — the title-bar switcher and its roster. */
  xs: { box: 'size-5', text: 'text-3xs', letters: 1 },
  /** 24px — a name in a line of text. */
  sm: { box: 'size-6', text: 'text-2xs', letters: 1 },
  /** 32px — list rows. */
  md: { box: 'size-8', text: 'text-caption', letters: 2 },
  /** 48px. */
  lg: { box: 'size-12', text: 'text-title', letters: 2 },
  /** 64px — a page's identity header. */
  xl: { box: 'size-16', text: 'text-display-sm', letters: 2 },
}

export function AccountAvatar({
  accountId,
  children,
  className,
  lazy = false,
  name,
  size = 'md',
}: {
  accountId: string
  /** Overlays — a badge in a corner — drawn over the portrait. */
  children?: ReactNode
  /** Ring, shadow or placement for the round wrapper. */
  className?: string
  /**
   * Hold the request until the avatar is near the viewport. For long lists,
   * so only the rows someone can see are looked up.
   */
  lazy?: boolean
  /** The display name: the image's alt text and the initials. */
  name: string
  size?: AccountAvatarSize
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const near = useNearViewport(ref, lazy)
  const avatar = useAccountAvatar(accountId, { enabled: near })
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const src = avatar?.imageUrl ?? null
  const showImage = src !== null && failedSrc !== src
  const loaded = showImage && loadedSrc === src
  const { box, letters, text } = sizes[size]
  const initials = avatarInitials(name)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none rounded-full',
        box,
        className
      )}
      ref={ref}
    >
      <span className="absolute inset-0 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border/50">
        {!loaded && (
          <span
            aria-label={name}
            className={cn(
              'grid size-full place-items-center bg-primary/15 font-semibold leading-none text-primary',
              text
            )}
            role="img"
          >
            {letters === 1 ? Array.from(initials)[0] : initials}
          </span>
        )}
        {showImage && (
          <img
            alt={loaded ? name : ''}
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-200',
              loaded ? 'opacity-100' : 'opacity-0'
            )}
            decoding="async"
            draggable={false}
            loading="lazy"
            src={src}
            onError={() => setFailedSrc(src)}
            onLoad={() => setLoadedSrc(src)}
          />
        )}
      </span>
      {children}
    </span>
  )
}

/*
 * One observer for every lazy avatar on screen: a friends list mounts
 * hundreds at once, and an observer each would be hundreds of observers.
 */
const nearCallbacks = new WeakMap<Element, () => void>()
let nearObserver: IntersectionObserver | null = null

function observeNear(element: Element, callback: () => void) {
  nearObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }

        nearCallbacks.get(entry.target)?.()
        nearCallbacks.delete(entry.target)
        nearObserver?.unobserve(entry.target)
      }
    },
    { rootMargin: '200px 0px' }
  )

  nearCallbacks.set(element, callback)
  nearObserver.observe(element)

  return () => {
    nearCallbacks.delete(element)
    nearObserver?.unobserve(element)
  }
}

/** True once the element has come within a couple of hundred pixels of view. */
function useNearViewport(ref: RefObject<Element>, enabled: boolean) {
  const [near, setNear] = useState(!enabled)

  useEffect(() => {
    if (!enabled || near) {
      return
    }

    const element = ref.current

    if (!element || typeof IntersectionObserver === 'undefined') {
      setNear(true)

      return
    }

    return observeNear(element, () => setNear(true))
  }, [enabled, near, ref])

  return near
}
