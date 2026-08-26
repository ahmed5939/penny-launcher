import { describe, expect, it } from 'vitest'

import { createLauncherArguments } from './launcher-arguments'

describe('launcher arguments', () => {
  it('keeps shell metacharacters inside individual arguments', () => {
    const args = createLauncherArguments({
      accountId: 'id & calc.exe',
      displayName: 'Player & whoami',
      exchangeCode: 'code & shutdown',
    })

    expect(args).toContain('-epicuserid=id & calc.exe')
    expect(args).toContain('-epicusername=Player & whoami')
    expect(args).toContain('-AUTH_PASSWORD=code & shutdown')
    expect(args).toHaveLength(8)
  })
})
