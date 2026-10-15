const electronPrefix = /^Error invoking remote method '[^']+': (?:\w*Error: )?/

/** The message to show for an error that crossed the IPC bridge. */
export function ipcErrorMessage(cause: unknown, fallback: string) {
  const message = cause instanceof Error ? cause.message.replace(electronPrefix, '') : ''
  return message && message !== 'Request failed.' ? message : fallback
}
