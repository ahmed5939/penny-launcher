const IN_USE_CODES = ['EBUSY', 'EPERM', 'EACCES']

/**
 * A failure whose message is already written for the user. Wrappers rethrow
 * it unchanged so the outer catch shows the same advice instead of a generic
 * one.
 */
export class FileTweakError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileTweakError'
  }
}

export function describeFileError(error: unknown, action: string): string {
  if (error instanceof FileTweakError) {
    return error.message
  }

  const code = (error as NodeJS.ErrnoException)?.code

  if (code && IN_USE_CODES.includes(code)) {
    return `Could not ${action}: the file is in use. Close Fortnite and try again.`
  }

  if (code === 'ENOENT') {
    return `Could not ${action}: the file was not found. Check the game folder in Settings.`
  }

  return `Could not ${action}. Try again.`
}
