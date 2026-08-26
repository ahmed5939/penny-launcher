export function createLauncherArguments(config: {
  accountId: string
  displayName: string
  exchangeCode: string
}) {
  return [
    '-AUTH_LOGIN=unused',
    `-AUTH_PASSWORD=${config.exchangeCode}`,
    '-AUTH_TYPE=exchangecode',
    '-epicapp=Fortnite',
    '-epicenv=Prod',
    '-EpicPortal',
    `-epicusername=${config.displayName}`,
    `-epicuserid=${config.accountId}`,
  ]
}
