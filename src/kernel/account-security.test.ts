import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_SECRET_PREFIX,
  accountNeedsSecretMigration,
  decryptAccountSecrets,
  decryptCredential,
  encryptAccountSecrets,
  encryptCredential,
  isEncryptedCredential,
  type SecretVault,
} from './account-secrets'
import { resolveLauncherDataDirectory } from './launcher-paths'
import { redactSecrets } from './secret-redaction'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function createMemoryVault(available = true): SecretVault {
  const mask = 0x5a

  return {
    isEncryptionAvailable: () => available,
    encryptString: (plainText) =>
      Buffer.from(Array.from(Buffer.from(plainText, 'utf8'), (byte) => byte ^ mask)),
    decryptString: (cipherText) =>
      Buffer.from(Array.from(cipherText, (byte) => byte ^ mask)).toString('utf8'),
  }
}

function isGitIgnored(relativePath: string) {
  const result = spawnSync('git', ['check-ignore', '-q', '--', relativePath], {
    cwd: repoRoot,
  })

  return result.status === 0
}

function isGitTracked(relativePath: string) {
  const result = spawnSync(
    'git',
    ['ls-files', '--error-unmatch', '--', relativePath],
    { cwd: repoRoot, encoding: 'utf8' }
  )

  return result.status === 0
}

describe('account secret encryption', () => {
  it('round-trips device-auth through the enc:v1 prefix', () => {
    const vault = createMemoryVault()
    const account = {
      accountId: 'acct-1',
      deviceId: 'device-id-plain',
      displayName: 'TestPlayer',
      secret: 'device-secret-plain',
    }

    const stored = encryptAccountSecrets(account, vault)

    expect(stored.deviceId.startsWith(ACCOUNT_SECRET_PREFIX)).toBe(true)
    expect(stored.secret.startsWith(ACCOUNT_SECRET_PREFIX)).toBe(true)
    expect(stored.deviceId).not.toContain(account.deviceId)
    expect(stored.secret).not.toContain(account.secret)
    expect(decryptAccountSecrets(stored, vault)).toEqual(account)
  })

  it('encrypts plaintext Aerial-style accounts the same way a save does', () => {
    const vault = createMemoryVault()
    const aerialAccount = {
      accountId: 'acct-aerial',
      deviceId: 'imported-device-id',
      displayName: 'ImportedPlayer',
      secret: 'imported-device-secret',
    }

    expect(accountNeedsSecretMigration(aerialAccount)).toBe(true)

    const stored = encryptAccountSecrets(aerialAccount, vault)

    expect(accountNeedsSecretMigration(stored)).toBe(false)
    expect(decryptCredential(stored.secret, vault)).toBe(aerialAccount.secret)
  })

  it('leaves values unchanged when OS encryption is unavailable', () => {
    const vault = createMemoryVault(false)

    expect(encryptCredential('plain-secret', vault)).toBe('plain-secret')
    expect(() =>
      decryptCredential(`${ACCOUNT_SECRET_PREFIX}AAAA`, vault)
    ).toThrow(/unavailable/)
  })

  it('does not double-encrypt values that already have the prefix', () => {
    const vault = createMemoryVault()
    const encrypted = encryptCredential('plain-secret', vault)

    expect(encryptCredential(encrypted, vault)).toBe(encrypted)
    expect(isEncryptedCredential(encrypted)).toBe(true)
  })
})

describe('launcher data directory path', () => {
  it('joins a real appData path and refuses undefined coercion', () => {
    expect(resolveLauncherDataDirectory('/home/player/AppData')).toBe(
      path.join('/home/player/AppData', 'penny-launcher-data')
    )
    expect(() => resolveLauncherDataDirectory(undefined)).toThrow(/unavailable/)
    expect(() => resolveLauncherDataDirectory('undefined')).toThrow(/unavailable/)
    expect(() => resolveLauncherDataDirectory('')).toThrow(/unavailable/)
  })
})

describe('secret redaction', () => {
  it('strips device-auth, tokens, and enc:v1 blobs from log text', () => {
    const leaked = redactSecrets(
      'secret: SUPERSECRET deviceId=ABCDEF access_token=tok123 enc:v1:YmFzZTY0'
    )

    expect(leaked).not.toContain('SUPERSECRET')
    expect(leaked).not.toContain('ABCDEF')
    expect(leaked).not.toContain('tok123')
    expect(leaked).not.toContain('YmFzZTY0')
    expect(leaked).toContain('[redacted]')
  })
})

describe('gitignore hygiene', () => {
  it('covers accidental data-dir dumps and account files without ignoring source', () => {
    const gitignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8')

    expect(gitignore).toMatch(/undefined\//)
    expect(gitignore).toMatch(/\*\*\/penny-launcher-data\//)
    expect(gitignore).toMatch(/accounts\.json/)
    expect(gitignore).toMatch(/dev-accounts\.json/)

    expect(isGitIgnored('undefined/penny-launcher-data/dev-accounts.json')).toBe(
      true
    )
    expect(isGitIgnored('foo/penny-launcher-data/settings.json')).toBe(true)
    expect(isGitIgnored('accounts.json')).toBe(true)
    expect(isGitIgnored('dev-accounts.json')).toBe(true)
    expect(isGitIgnored('settings.json')).toBe(true)

    expect(isGitIgnored('src/locales/en-US/settings.json')).toBe(false)
    expect(isGitIgnored('src/kernel/startup/accounts.ts')).toBe(false)
    expect(isGitIgnored('src/lib/validations/schemas/accounts.ts')).toBe(false)

    expect(
      isGitTracked('undefined/penny-launcher-data/dev-accounts.json')
    ).toBe(false)
  })
})
