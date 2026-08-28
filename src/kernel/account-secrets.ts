/**
 * Account device-auth is persisted with Electron `safeStorage` (OS DPAPI /
 * keychain). The `enc:v1:` prefix distinguishes ciphertext from leftover
 * plaintext so a launch can migrate Aerial copies and older files.
 */

export const ACCOUNT_SECRET_PREFIX = 'enc:v1:'

export type SecretVault = {
  isEncryptionAvailable: () => boolean
  encryptString: (plainText: string) => Buffer
  decryptString: (cipherText: Buffer) => string
}

export function isEncryptedCredential(value: string) {
  return value.startsWith(ACCOUNT_SECRET_PREFIX)
}

export function encryptCredential(value: string, vault: SecretVault) {
  if (isEncryptedCredential(value) || !vault.isEncryptionAvailable()) {
    return value
  }

  return `${ACCOUNT_SECRET_PREFIX}${vault.encryptString(value).toString('base64')}`
}

export function decryptCredential(value: string, vault: SecretVault) {
  if (!isEncryptedCredential(value)) {
    return value
  }

  if (!vault.isEncryptionAvailable()) {
    throw new Error('Secure account storage is unavailable.')
  }

  return vault.decryptString(
    Buffer.from(value.slice(ACCOUNT_SECRET_PREFIX.length), 'base64')
  )
}

export function accountNeedsSecretMigration(account: {
  deviceId: string
  secret: string
}) {
  return (
    !isEncryptedCredential(account.deviceId) ||
    !isEncryptedCredential(account.secret)
  )
}

export function encryptAccountSecrets<
  Account extends { deviceId: string; secret: string },
>(account: Account, vault: SecretVault): Account {
  return {
    ...account,
    deviceId: encryptCredential(account.deviceId, vault),
    secret: encryptCredential(account.secret, vault),
  }
}

export function decryptAccountSecrets<
  Account extends { deviceId: string; secret: string },
>(account: Account, vault: SecretVault): Account {
  return {
    ...account,
    deviceId: decryptCredential(account.deviceId, vault),
    secret: decryptCredential(account.secret, vault),
  }
}
