import type { NewsMessage } from './model'

import { Newspaper } from 'lucide-react'

import {
  Callout,
  EmptyState,
  ListRow,
  Panel,
  PanelBody,
  PanelHeader,
  PanelSectionHeader,
  RefreshButton,
} from '../../components/page'

import { useGameNews } from '../../state/home/game-news'

/**
 * Fortnite's current in-game news, read straight from Epic's public content
 * CMS — no account, no token. Save the World news first, then Battle Royale,
 * with any active emergency notice called out at the bottom in a louder tone.
 *
 * Compact by design: it sits on the home screen next to everything else, so
 * each item is a one-line teaser rather than the full in-game card.
 */
export function GameNewsPanel() {
  const { stw, br, notices, errorMessage, isLoading, isEmpty, handleRefresh } =
    useGameNews()

  const hasNews = stw.length > 0 || br.length > 0

  return (
    <Panel>
      <PanelHeader
        compact
        icon={Newspaper}
        title="In-game news"
        actions={
          <RefreshButton loading={isLoading} onClick={handleRefresh} />
        }
      />

      {errorMessage && isEmpty ? (
        <PanelBody>
          <Callout tone="warning">
            Could not reach the Epic Games news service. Try Refresh.
          </Callout>
        </PanelBody>
      ) : isLoading && isEmpty ? (
        <PanelBody>
          <p className="text-ui text-muted-foreground" role="status">
            Loading news…
          </p>
        </PanelBody>
      ) : isEmpty ? (
        <EmptyState
          className="border-0 bg-transparent py-8"
          icon={Newspaper}
          title="No news right now"
          description="Fortnite isn't showing any in-game news at the moment."
        />
      ) : (
        <>
          {stw.length > 0 && (
            <>
              <PanelSectionHeader title="Save the World" />
              <ul className="px-4 py-2">
                {stw.map((message, index) => (
                  <NewsRow key={`stw-${index}`} message={message} />
                ))}
              </ul>
            </>
          )}

          {br.length > 0 && (
            <>
              <PanelSectionHeader title="Battle Royale" />
              <ul className="px-4 py-2">
                {br.map((message, index) => (
                  <NewsRow key={`br-${index}`} message={message} />
                ))}
              </ul>
            </>
          )}

          {notices.length > 0 && (
            <PanelBody className={hasNews ? 'border-t border-border/30' : undefined}>
              <div className="space-y-2">
                {notices.map((notice, index) => (
                  <Callout
                    key={`notice-${index}`}
                    tone="danger"
                    title={notice.title || 'Service notice'}
                  >
                    {notice.body}
                  </Callout>
                ))}
              </div>
            </PanelBody>
          )}
        </>
      )}
    </Panel>
  )
}

function NewsRow({ message }: { message: NewsMessage }) {
  return (
    <ListRow
      caption={message.body || undefined}
      name={message.title || 'Untitled'}
      well={
        message.image ? (
          <span className="block aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-muted/20">
            <img
              alt=""
              aria-hidden
              className="size-full object-cover"
              decoding="async"
              loading="lazy"
              src={message.image}
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          </span>
        ) : undefined
      }
    />
  )
}
