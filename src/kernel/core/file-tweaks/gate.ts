import { createHash } from 'node:crypto'

/**
 * File Tweaks are experimental and hidden behind a personal access key.
 *
 * The key never lives in the code — only its SHA-256 digest does. Unlock
 * state is main-process memory only, so every app restart requires
 * re-entering the key, and every file-tweak IPC handler refuses work
 * until the gate is open.
 */

const KEY_DIGEST = '6e58b821db4dd248b5c059cad7d77a6bf21579594d122ccfd05e1e22922c999e'

let unlocked = false

export function fileTweaksUnlock(key: string): boolean {
  const digest = createHash('sha256')
    .update(key.trim(), 'utf8')
    .digest('hex')

  if (digest === KEY_DIGEST) {
    unlocked = true
  }

  return unlocked
}

export function fileTweaksIsUnlocked(): boolean {
  return unlocked
}
