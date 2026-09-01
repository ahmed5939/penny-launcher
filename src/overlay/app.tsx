import type { OverlayQuestGroup, OverlaySnapshot } from '../types/overlay'

import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'

import './styles.css'

const groupLabels: Record<OverlayQuestGroup, string> = {
  daily: 'Daily',
  ventures: 'Ventures',
  weekly: 'Weekly',
  'storm-shield': 'Storm Shield',
  wargames: 'Wargames',
  dungeons: 'Dungeons',
  endurance: 'Endurance',
  active: 'Active',
}

function OverlayApp() {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot>({
    players: [],
    status: 'Loading public quest data…',
    updatedAt: new Date().toISOString(),
  })

  useEffect(() => {
    const listener = window.pennyOverlay.onSnapshot(setSnapshot)

    return () => listener.removeListener()
  }, [])

  return (
    <main className="quest-overlay">
      <header className="overlay-header">
        <div>
          <p className="eyebrow">Penny</p>
          <h1>Squad quests</h1>
        </div>
        <div className="live-indicator">
          <span /> Public data
        </div>
      </header>

      {snapshot.status && snapshot.players.length === 0 ? (
        <section className="overlay-empty">{snapshot.status}</section>
      ) : (
        <div className="player-list">
          {snapshot.players.map((player) => (
            <section className="player-card" key={player.displayName}>
              <div className="player-heading">
                <div>
                  <h2>{player.displayName}</h2>
                  {player.mission && (
                    <p>
                      {player.mission}
                      {player.missionDetails
                        ? ` · ${player.missionDetails}`
                        : ''}
                    </p>
                  )}
                </div>
                {player.ventureLevel && (
                  <div className="venture-level">
                    <span>Ventures</span>
                    <strong>{player.ventureLevel}</strong>
                    {player.venturePowerLevel !== undefined && (
                      <small>PL {player.venturePowerLevel}</small>
                    )}
                  </div>
                )}
              </div>

              {player.errorMessage ? (
                <p className="error-message">{player.errorMessage}</p>
              ) : player.quests.length === 0 ? (
                <p className="no-quests">No public active quests found.</p>
              ) : (
                <ul className="quest-list">
                  {player.quests.map((quest) => {
                    const progress =
                      quest.current !== undefined && quest.total !== undefined
                        ? Math.min(
                            100,
                            (quest.current / Math.max(quest.total, 1)) * 100
                          )
                        : undefined

                    return (
                      <li key={`${quest.group}-${quest.id}`}>
                        <div className="quest-row">
                          <span className={`quest-group group-${quest.group}`}>
                            {groupLabels[quest.group]}
                          </span>
                          <strong>{quest.name}</strong>
                          {quest.current !== undefined && (
                            <span className="quest-count">
                              {quest.current}
                              {quest.total !== undefined
                                ? `/${quest.total}`
                                : ''}
                            </span>
                          )}
                        </div>
                        {quest.description && (
                          <p className="quest-description">{quest.description}</p>
                        )}
                        {progress !== undefined && (
                          <div className="progress-track">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <footer>
        <span>Ctrl + Shift + Q to hide</span>
        <time>
          Updated {new Date(snapshot.updatedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </footer>
    </main>
  )
}

createRoot(document.getElementById('app')!).render(<OverlayApp />)
