import type { PropsWithChildren } from 'react'

import { useState } from 'react'

import { Header } from './header'

import { AccountRail } from '../components/shell/account-rail'
import { CommandPalette } from '../components/navigation/command-palette'
import { FriendsPanel } from '../components/friends/panel'
import { ScrollArea } from '../components/ui/scroll-area'
import { StatusBar } from '../components/shell/status-bar'

import { useWindowChrome } from '../hooks/ui/window-chrome'
import { useTaskbarSync } from '../hooks/ui/taskbar'
import { useAppKeyboard } from '../hooks/ui/keyboard'

/**
 * App shell: titlebar, then rail beside a single content pane, then a status
 * bar. The desktop three-zone arrangement.
 *
 * This reverses an earlier decision to have no left rail and hang the tools
 * off four dropdown menus. That trade bought content width and cost more than
 * it was worth: every navigation took two clicks, the app could not show you
 * where you were without being opened, and — the real problem — the accounts,
 * which are what this app is *about*, were a single value hidden inside a
 * combo box. The rail puts the roster and the destinations in the same column,
 * both permanently visible.
 *
 * The content pane is full-bleed. A centred `max-w-6xl` column with gutters is
 * a document layout; a window is already the frame.
 */
export function MainLayout({ children }: PropsWithChildren) {
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Puts `mica` / `maximized` on the document element and keeps
  // `--header-height` in step with the caption buttons Windows draws.
  useWindowChrome()
  // Badge, jump list, and the jump list's way back into the scope.
  useTaskbarSync()
  // Alt+Left, F5, Ctrl+1..9, Ctrl+Tab.
  useAppKeyboard()

  return (
    <div className="flex h-screen w-full flex-col">
      <Header onOpenPalette={() => setPaletteOpen(true)} />

      <div className="flex min-h-0 flex-1">
        <AccountRail />

        {/*
          The friends panel is a sibling of the content, not an overlay — the
          app stays usable while it is open, and the content simply gets less
          width rather than being covered.
        */}
        <div className="mica-content flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/*
              `flex-1 min-h-0` rather than a `100vh` subtraction: every
              ancestor up to the window is already a flex box, so the pane
              takes whatever the titlebar and the status bar leave it and
              cannot fall out of step with either one's height.
            */}
            <ScrollArea
              className="min-h-0 flex-1"
              viewportClassName="main-wrapper-content"
            >
              <main className="flex w-full flex-col gap-4 p-5 lg:gap-6">
                {children}
              </main>
            </ScrollArea>
          </div>

          <FriendsPanel />
        </div>
      </div>

      <StatusBar />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </div>
  )
}
