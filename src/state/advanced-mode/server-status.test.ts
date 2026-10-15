import { beforeEach, describe, expect, it } from 'vitest'

import type { ServerStatusPayload, StatusPage } from '../../features/server-status/model'
import { useServerStatusStore } from './server-status'

const page: StatusPage = { groups: [], incidents: [], standalone: [] }
const laterPage: StatusPage = { groups: [], incidents: [], standalone: [] }

const answered: ServerStatusPayload = {
  errors: [],
  fortnite: { maintenanceUri: null, message: '', status: 'UP' },
  statusPage: page,
}

const failed: ServerStatusPayload = {
  errors: ["Couldn't reach Epic's status page."],
  fortnite: { maintenanceUri: null, message: '', status: 'UP' },
  statusPage: null,
}

describe('server status last status page', () => {
  beforeEach(() => useServerStatusStore.setState({ checkedAt: null, lastStatusPage: null, status: null }))

  it('keeps the last status page that answered through a failed check', () => {
    useServerStatusStore.getState().setResponse(answered, 1000)
    useServerStatusStore.getState().setResponse(failed, 2000)

    expect(useServerStatusStore.getState()).toMatchObject({
      checkedAt: 2000,
      lastStatusPage: { checkedAt: 1000, page },
      status: failed,
    })
  })

  it('replaces it when a later check gets the status page back', () => {
    useServerStatusStore.getState().setResponse(answered, 1000)
    useServerStatusStore.getState().setResponse(failed, 2000)
    useServerStatusStore.getState().setResponse({ ...answered, statusPage: laterPage }, 3000)

    expect(useServerStatusStore.getState().lastStatusPage).toEqual({ checkedAt: 3000, page: laterPage })
  })
})
