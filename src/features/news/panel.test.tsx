import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const news = vi.hoisted(() => ({ state: {} as Record<string, unknown> }))
vi.mock('../../state/home/game-news', () => ({
  useGameNews: () => news.state,
}))

import { GameNewsPanel } from './panel'

beforeEach(() => {
  news.state = { stw: [], br: [], notices: [], errorMessage: null, isLoading: false, isEmpty: true, handleRefresh: () => undefined }
})

describe('GameNewsPanel', () => {
  it('announces a failed load as an alert in the danger tone', () => {
    news.state = { ...news.state, errorMessage: 'HTTP 503' }
    const html = renderToStaticMarkup(createElement(GameNewsPanel))

    expect(html).toMatch(/role="alert"[\s\S]*Could not load the news/)
    expect(html).toContain('Could not reach the Epic Games news service. Try Refresh.')
    expect(html).toContain('bg-destructive')
  })

  it('shows the empty state without an alert when the feed is simply empty', () => {
    const html = renderToStaticMarkup(createElement(GameNewsPanel))

    expect(html).toContain('No news right now')
    expect(html).not.toContain('role="alert"')
  })
})
