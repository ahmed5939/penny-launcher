export function createLauncherArguments(config: {
  accountId: string
  displayName: string
  exchangeCode: string
  /**
   * The island to open straight into (`campaign`, `playlist_juno`…), as the
   * Epic Games Launcher's mode tiles do. Before the user's arguments, so a
   * configured override still wins.
   */
  islandOverride?: string | null
  /** Extra user-configured arguments, appended last so they win. */
  launchArgs?: string
}) {
  const args = [
    '-AUTH_LOGIN=unused',
    `-AUTH_PASSWORD=${config.exchangeCode}`,
    '-AUTH_TYPE=exchangecode',
    '-epicapp=Fortnite',
    '-epicenv=Prod',
    '-EpicPortal',
    `-epicusername=${config.displayName}`,
    `-epicuserid=${config.accountId}`,
  ]

  if (config.islandOverride && isIslandOverride(config.islandOverride)) {
    args.push(`-IslandOverride=${config.islandOverride}`)
  }

  if (config.launchArgs) {
    // Split on whitespace but keep quoted flags whole: -KEY="two words".
    const custom = config.launchArgs.match(/"[^"]*"|\S+/g) ?? []

    for (const raw of custom) {
      const arg = raw.replace(/^"(.*)"$/, '$1').trim()

      if (arg) {
        args.push(arg)
      }
    }
  }

  return args
}

/** An island id as the catalogue writes them: letters, digits, underscores, dashes. */
export function isIslandOverride(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}
