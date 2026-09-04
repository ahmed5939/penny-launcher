import { Link } from '@tanstack/react-router'
import { useShallow } from 'zustand/react/shallow'
import { Contact, Rocket, Square, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '../../components/ui/button'
import { Sheet, SheetContent } from '../../components/ui/sheet'

import { AccountSwitcher } from '../../components/shell/account-switcher'
import { OverflowMenu } from '../../components/shell/overflow-menu'
import { useGameAction } from '../../hooks/ui/game-action'
import { HistoryMenu } from '../../components/menu/history'
import { Kbd } from '../../components/page'
import { PennyAvatar } from '../../components/branding/penny-portrait'

import { useUISidebarHistory } from '../../hooks/ui/sidebars'

import { useFriendsManagerStore } from '../../state/management/friends-manager'

import { cn } from '../../lib/utils'

/**
 * Titlebar.
 *
 * The minimise and close buttons that used to live here were HTML, which
 * meant `frame: false`, which meant no maximize and no Snap Layouts — Windows
 * only attaches that flyout to caption buttons it drew itself. They are the
 * system's now, sitting in the overlay region; this strip stops short of them
 * via `titlebar-area-width` so nothing ever renders underneath.
 *
 * The whole strip is draggable except the controls, which opt back out via
 * `not-draggable-region`. Double-clicking the drag region maximises, the way
 * every other window on the OS does.
 *
 * Search lives up here beside the wordmark rather than down in the section
 * bar: it searches the whole app, so sitting inside a row of section menus
 * read as if it only filtered them.
 */
export function Header({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { t } = useTranslation(['general'])

  return (
    <header
      className="app-draggable-region titlebar-area chrome-surface relative z-20 flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-border/60 pl-3"
      data-app-focus-region="header"
      tabIndex={-1}
    >
      <Link
        to="/"
        className="not-draggable-region group flex items-center gap-2 rounded-lg py-1 pr-1"
        title="Penny"
      >
        <PennyAvatar className="size-[22px] shadow-[0_0_10px_hsl(var(--primary)/0.45)] transition-transform group-hover:scale-105" />
        <span className="brand-text text-[0.9375rem] font-bold leading-none tracking-tight max-[760px]:hidden">
          Penny
        </span>
      </Link>

      <button
        type="button"
        className={cn(
          'not-draggable-region group flex h-7 w-56 items-center gap-2 rounded-lg max-[900px]:w-8 max-[900px]:justify-center max-[900px]:px-0',
          'border border-border/70 bg-background/60 pl-2.5 pr-1.5',
          'text-xs text-muted-foreground transition-colors',
          'hover:border-primary/40 hover:bg-accent/30 hover:text-foreground',
        )}
        onClick={onOpenPalette}
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left max-[900px]:hidden">
          {t('actions.search')}
        </span>
        {/*
          `Kbd` draws the chip but takes no class of its own, so the wrapper is
          what stops the label beside it from squeezing the shortcut.
        */}
        <span className="shrink-0 max-[900px]:hidden">
          <Kbd>Ctrl K</Kbd>
        </span>
      </button>

      <div className="not-draggable-region ml-auto flex items-center gap-1 pr-1">
        <AccountSwitcher />

        <LaunchGameButton />

        <FriendsToggle />

        <OverflowMenu />

        <HistorySheet />
      </div>
    </header>
  )
}

/** Launch Fortnite for the account currently selected in the titlebar. */
function LaunchGameButton() {
  const { t } = useTranslation(['general'])
  const { isRunning, canLaunch, launch, close } = useGameAction({
    autoLoad: true,
  })
  const label = isRunning ? t('close-game.button') : t('launch-game.button')
  return (
    <Button
      type="button"
      size="sm"
      variant={isRunning ? 'outline' : 'default'}
      className={
        isRunning
          ? 'border-destructive/40 text-destructive hover:text-destructive'
          : undefined
      }
      title={label}
      aria-label={label}
      disabled={!isRunning && !canLaunch}
      onClick={isRunning ? close : launch}
    >
      {isRunning ? (
        <Square className="size-3.5" />
      ) : (
        <Rocket className="size-4" />
      )}
      <span className="max-[700px]:hidden">{label}</span>
    </Button>
  )
}

/**
 * Friends toggle.
 *
 * Reads as a labelled control rather than one more anonymous icon: it names
 * itself, carries the loaded friend count, and lights up while the panel is
 * open so the panel never looks like it appeared on its own.
 */
function FriendsToggle() {
  const { isOpen, togglePanel, total } = useFriendsManagerStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      togglePanel: state.togglePanel,
      total: state.entries.filter((entry) => entry.kind === 'friend').length,
    })),
  )

  return (
    <button
      type="button"
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors',
        isOpen
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-transparent text-muted-foreground hover:bg-accent/30 hover:text-foreground',
      )}
      title={isOpen ? 'Hide friends' : 'Show friends'}
      onClick={togglePanel}
    >
      <Contact className="size-4 shrink-0" />
      <span className="max-[900px]:hidden">Friends</span>
      {total > 0 && (
        <span
          className={cn(
            'figure rounded-lg px-1 text-[0.625rem] font-semibold',
            isOpen ? 'bg-primary/20' : 'bg-muted',
          )}
        >
          {total}
        </span>
      )}
    </button>
  )
}

function HistorySheet() {
  const { changeVisibility, visibility } = useUISidebarHistory()

  return (
    <Sheet open={visibility} onOpenChange={changeVisibility}>
      <SheetContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('shell-more')?.focus()
        }}
        className="flex flex-col p-0"
        hideCloseButton
      >
        <HistoryMenu />
      </SheetContent>
    </Sheet>
  )
}
