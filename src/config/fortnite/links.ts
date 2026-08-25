import { defaultFortniteClient } from './clients'

export const epicGamesLoginURL = 'https://www.epicgames.com/id/login'
export const epicGamesAuthorizationCodeURL = `https://www.epicgames.com/id/api/redirect?clientId=${defaultFortniteClient.use.clientId}&responseType=code`

export function epicGamesAccountSettingsURL(exchangeCode: string) {
  return `https://www.epicgames.com/id/exchange?exchangeCode=${exchangeCode}`
}

export function pennyDBProfileURL(displayName: string) {
  return `https://pennydb.net/profile/${encodeURIComponent(displayName)}`
}
