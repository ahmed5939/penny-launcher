const IN_USE_CODES = ['EBUSY', 'EPERM', 'EACCES']

export function describeFileError(error: unknown, action: string): string {
  const code = (error as NodeJS.ErrnoException)?.code

  if (code && IN_USE_CODES.includes(code)) {
    return `Could not ${action}: the file is in use. Close Fortnite and try again.`
  }

  if (code === 'ENOENT') {
    return `Could not ${action}: the file was not found. Check the game folder in Settings.`
  }

  return `Could not ${action}. Try again.`
}
