/**
 * `author` in package.json stays Ciensprog for upstream attribution.
 * Current maintainer is listed under `contributors` (Ahmed / ahmed5939).
 */
export const repositoryURL = 'https://github.com/ahmed5939/penny-launcher'

export const repositoryReleasesURL = `${repositoryURL}/releases`

export const supportDiscordServerURL = 'https://discord.gg/QUVFA8GePH'

export const repositoryAssetsURL =
  'https://raw.githubusercontent.com/ahmed5939/penny-launcher/main/assets'

/**
 * Penny DB (https://pennydb.net) integrations.
 *
 * Penny DB is a Fortnite companion / tracker for STW missions, leaderboards,
 * the item shop, BR stats and cosmetics. These deep-links surface that data
 * directly from inside Penny.
 */
export const pennyDbURL = 'https://pennydb.net'
export const pennyDbLinks = {
  home: 'https://pennydb.net',
  stwMissions: 'https://pennydb.net/stw-missions',
  stwLeaderboard: 'https://pennydb.net/stw-leaderboard',
  stwShop: 'https://pennydb.net/stw-shop',
  donate: 'https://pennydb.net/donate',
  discordBot: 'https://top.gg/bot/1067432638425612388',
} as const
