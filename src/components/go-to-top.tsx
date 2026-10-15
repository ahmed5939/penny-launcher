import { useTranslation } from 'react-i18next'
import { memo, useEffect, useState } from 'react'

import { Button } from './ui/button'

import { cn } from '../lib/utils'

type GoToTopProps = {
  containerId?: string
}

export const GoToTop = memo<GoToTopProps>(() => {
  const { t } = useTranslation(['general'])

  const { scrollToTopButtonIsVisible, scrollButtonOnClick } =
    useScrollToTop()

  return (
    <Button
      aria-hidden={!scrollToTopButtonIsVisible}
      className={cn(
        'bottom-[calc(var(--status-bar-height)_+_1rem)] fixed px-4 right-5 transition-all z-30',
        {
          'opacity-100 translate-x-0': scrollToTopButtonIsVisible,
          'opacity-0 pointer-events-none translate-x-28': !scrollToTopButtonIsVisible,
        }
      )}
      size="sm"
      tabIndex={scrollToTopButtonIsVisible ? undefined : -1}
      variant="secondary"
      onClick={scrollButtonOnClick}
    >
      {t('go-to-top')}
    </Button>
  )
})

function useScrollToTop() {
  const [scrollToTopButtonIsVisible, setScrollToTopButtonIsVisible] =
    useState(false)

  useEffect(() => {
    const $scroller = document.querySelector<HTMLElement>(
      '.main-wrapper-content'
    )

    if (!$scroller) {
      return undefined
    }

    const onScroll = () => {
      setScrollToTopButtonIsVisible(
        $scroller.scrollTop > $scroller.clientHeight
      )
    }

    onScroll()
    $scroller.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      $scroller.removeEventListener('scroll', onScroll)
    }
  }, [])

  const scrollButtonOnClick = () => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    document.querySelector('.main-wrapper-content')?.scroll({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      top: 0,
    })
  }

  return {
    scrollToTopButtonIsVisible,
    scrollButtonOnClick,
  }
}
