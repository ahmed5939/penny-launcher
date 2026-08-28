export function createLauncherArguments(config: {
  accountId: string
  displayName: string
  exchangeCode: string
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
