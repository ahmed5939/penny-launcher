import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ShellState = {
  paneCollapsed: boolean
  lastPaths: Record<string, string>
  togglePane: () => void
  rememberPath: (area: string, pathname: string) => void
}

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      paneCollapsed: false,
      lastPaths: {},
      togglePane: () =>
        set((state) => ({ paneCollapsed: !state.paneCollapsed })),
      rememberPath: (area, pathname) =>
        set((state) =>
          state.lastPaths[area] === pathname
            ? state
            : {
                lastPaths: { ...state.lastPaths, [area]: pathname },
              },
        ),
    }),
    {
      name: 'penny-shell',
      partialize: ({ paneCollapsed }) => ({ paneCollapsed }),
    },
  ),
)
