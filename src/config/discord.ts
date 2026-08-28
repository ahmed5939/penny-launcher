/**
 * Discord Rich Presence for Penny.
 *
 * Presence is published from the Electron main process over Discord's local
 * IPC socket. Nothing is injected into Fortnite (EAC would ban that).
 *
 * The Application ID is public — it is not a secret. Discord uses it to
 * title the activity "Penny". Recreate the app at
 * https://discord.com/developers/applications if this ID is ever rotated.
 */
export const discordApplicationId = '1410184029174304778'

export const discordApplicationName = 'Penny'
