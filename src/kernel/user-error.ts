/** An error whose message was written for the user. Only these reach the renderer. */
export class UserError extends Error {}

export function publicIpcMessage(error: unknown) {
  return error instanceof UserError && error.message ? error.message : 'Request failed.'
}
