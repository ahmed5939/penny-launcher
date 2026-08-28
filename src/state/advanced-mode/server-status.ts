import type {
  EpicComponentGroup,
  EpicComponent,
  EpicIncident,
  EpicOverallStatus,
  EpicStatusSummary,
  ServerStatusEntry,
  ServerStatusPayload,
} from '../../kernel/core/server-status'

import { create } from 'zustand'

export type ServerStatusState = {
  entries: Array<ServerStatusEntry>
  diagnostics: ServerStatusPayload['diagnostics']
  errorMessage: string | null
  page: EpicOverallStatus | null
  groups: Array<EpicComponentGroup>
  standalone: Array<EpicComponent>
  incidents: Array<EpicIncident>
  summary: EpicStatusSummary | null
  pageError: string | null
  isLoading: boolean
  lastCheckedAt: number | null

  setLoading: (value: boolean) => void
  setResponse: (config: {
    entries: Array<ServerStatusEntry>
    diagnostics?: ServerStatusPayload['diagnostics']
    errorMessage?: string
    checkedAt: number
  } & Pick<
    ServerStatusPayload,
    'groups' | 'incidents' | 'page' | 'standalone' | 'summary' | 'pageError'
  >) => void
}

export const useServerStatusStore = create<ServerStatusState>()((set) => ({
  entries: [],
  diagnostics: undefined,
  errorMessage: null,
  page: null,
  groups: [],
  standalone: [],
  incidents: [],
  summary: null,
  pageError: null,
  isLoading: false,
  lastCheckedAt: null,

  setLoading: (value) => set({ isLoading: value }),
  setResponse: ({
    entries,
    diagnostics,
    errorMessage,
    groups,
    incidents,
    page,
    standalone,
    summary,
    pageError,
    checkedAt,
  }) =>
    set({
      entries,
      diagnostics,
      errorMessage: errorMessage ?? null,
      groups: groups ?? [],
      incidents: incidents ?? [],
      page: page ?? null,
      standalone: standalone ?? [],
      summary: summary ?? null,
      pageError: pageError ?? null,
      isLoading: false,
      lastCheckedAt: checkedAt,
    }),
}))
