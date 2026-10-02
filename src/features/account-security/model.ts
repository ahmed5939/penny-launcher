/**
 * An Epic account's security, as `Account.myAccount` reports it to the
 * account itself: two-factor authentication, a verified email, the
 * platforms linked to it, and whether Epic has it in cabined (restricted,
 * under-age) mode.
 *
 * Two-factor matters most here: Fortnite will not let an account gift
 * items or trade in Save the World without it.
 */

export type LinkedPlatform = { type: string; label: string }

export type AccountSecurity = {
  status: 'ok' | 'unknown'
  tfaEnabled: boolean | null
  emailVerified: boolean | null
  /** ISO country of the account, as Epic has it. */
  country: string | null
  cabinedMode: boolean | null
  platforms: Array<LinkedPlatform>
  checkedAt: string
  errorMessage?: string
}

export type AccountSecurityPayload = {
  accounts: Record<string, AccountSecurity>
  /** The last reply of a check, carrying every linked account. */
  complete: boolean
}

/** Epic's external-auth types, as the game and the website name them. */
const platformLabels: Record<string, string> = {
  apple: 'Apple',
  facebook: 'Facebook',
  github: 'GitHub',
  google: 'Google',
  lego: 'LEGO',
  nintendo: 'Nintendo',
  psn: 'PlayStation',
  steam: 'Steam',
  twitch: 'Twitch',
  vk: 'VK',
  xbl: 'Xbox',
}

/** Consoles first: they are where an account's V-Bucks and purchases can live. */
const platformOrder = ['psn', 'xbl', 'nintendo', 'steam']

function record(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function flag(value: unknown) {
  return typeof value === 'boolean' ? value : null
}

export function platformLabel(type: string) {
  return platformLabels[type.toLowerCase()] ?? type.charAt(0).toUpperCase() + type.slice(1)
}

/** `Account.myAccount`, or null when it did not come back. Nothing personal is kept. */
export function parseMyAccount(
  body: unknown,
  checkedAt: string
): AccountSecurity | null {
  const account = record(record(record(record(body)?.data)?.Account)?.myAccount)

  if (!account) {
    return null
  }

  const auths = Array.isArray(account.externalAuths) ? account.externalAuths : []
  const types = [
    ...new Set(
      auths.flatMap((entry) => {
        const type = record(entry)?.type

        return typeof type === 'string' && type.trim() ? [type.trim().toLowerCase()] : []
      })
    ),
  ]
  const rank = (type: string) => {
    const index = platformOrder.indexOf(type)

    return index === -1 ? platformOrder.length : index
  }

  return {
    status: 'ok',
    tfaEnabled: flag(account.tfaEnabled),
    emailVerified: flag(account.emailVerified),
    country: typeof account.country === 'string' && account.country ? account.country : null,
    cabinedMode: flag(account.cabinedMode),
    platforms: types
      .sort((a, b) => rank(a) - rank(b) || platformLabel(a).localeCompare(platformLabel(b)))
      .map((type) => ({ type, label: platformLabel(type) })),
    checkedAt,
  }
}

/** What needs the player's attention, most serious first. */
export function securityIssues(security: AccountSecurity | undefined) {
  if (!security || security.status !== 'ok') {
    return []
  }

  return [
    security.tfaEnabled === false ? ('tfa' as const) : null,
    security.cabinedMode === true ? ('cabined' as const) : null,
    security.emailVerified === false ? ('email' as const) : null,
  ].filter((issue): issue is 'tfa' | 'cabined' | 'email' => issue !== null)
}
