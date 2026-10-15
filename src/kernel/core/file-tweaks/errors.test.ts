import { describe, expect, it } from 'vitest'

import { describeFileError } from './errors'

function errnoError(code: string): NodeJS.ErrnoException {
  return Object.assign(
    new Error(`${code}: resource busy or locked, open 'C:\\game\\pakchunk10.utoc'`),
    { code }
  )
}

describe('describeFileError', () => {
  it('asks the user to close Fortnite when the file is locked', () => {
    expect(describeFileError(errnoError('EBUSY'), 'patch the trap file')).toBe(
      'Could not patch the trap file: the file is in use. Close Fortnite and try again.'
    )
    expect(describeFileError(errnoError('EPERM'), 'read the game file')).toBe(
      'Could not read the game file: the file is in use. Close Fortnite and try again.'
    )
  })

  it('points to the game folder when the file is missing', () => {
    expect(describeFileError(errnoError('ENOENT'), 'read the game file')).toBe(
      'Could not read the game file: the file was not found. Check the game folder in Settings.'
    )
  })

  it('falls back to a retry prompt for an Error without a code', () => {
    expect(
      describeFileError(new Error('Not a .utoc file (bad magic)'), 'repair the game file index')
    ).toBe('Could not repair the game file index. Try again.')
  })

  it('falls back to a retry prompt for a non-Error value', () => {
    expect(describeFileError('boom', 'revert the trap file')).toBe(
      'Could not revert the trap file. Try again.'
    )
    expect(describeFileError(undefined, 'revert the trap file')).toBe(
      'Could not revert the trap file. Try again.'
    )
  })
})
