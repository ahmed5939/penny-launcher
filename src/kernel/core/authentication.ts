import { RuntimeLog } from '../runtime-log'
import type { CommonErrorResponse } from '../../types/services/errors'
import type {
  AccountData,
  AccountDataRecord,
  SyncAccountDataResponse,
} from '../../types/accounts'
import type { AuthenticationByDeviceProperties } from '../../types/authentication'
import type {
  EpicGamesSettingsNotificationCallbackResponseParam,
  GenerateExchangeCodeNotificationCallbackResponseParam,
  QuickLoginStatusParam,
} from '../../types/preload'

import { isAxiosError } from 'axios'
import { shell } from 'electron'

import { ElectronAPIEventKeys } from '../../config/constants/main-process'
import { nintendoSwitchGameClient } from '../../config/fortnite/clients'

import { MainWindow } from '../startup/windows/main'
import { AccountsManager } from '../startup/accounts'
import { DataDirectory } from '../startup/data-directory'
import { Unlock } from './unlock'

import {
  createAccessTokenUsingClientCredentials,
  createDeviceAuthCredentials,
  createDeviceAuthorization,
  getAccessTokenUsingAuthorizationCode,
  getAccessTokenUsingDeviceAuth,
  getAccessTokenUsingDeviceCode,
  getAccessTokenUsingExchangeCode,
  getExchangeCodeUsingAccessToken,
  getExchangeCodeUsingDeviceCodeToken,
  oauthVerify,
} from '../../services/endpoints/oauth'

import { LauncherAuthError } from '../../lib/validations/schemas/fortnite/auth'
import { accountDataSchema } from '../../lib/validations/schemas/accounts'

export class Authentication {
  static async authorization(code: string) {
    try {
      const responseAuthorization =
        await getAccessTokenUsingAuthorizationCode(code)
      const responseDevice =
        await Authentication.generateDeviceAuthCredencials(
          ElectronAPIEventKeys.ResponseAuthWithAuthorization,
          {
            accessToken: responseAuthorization.data.access_token,
            accountId: responseAuthorization.data.account_id,
          }
        )

      const accountData = {
        accessToken: responseAuthorization.data.access_token,
        accountId: responseAuthorization.data.account_id,
        deviceId: responseDevice?.deviceId,
        displayName: responseAuthorization.data.displayName,
        secret: responseDevice?.secret,
      } as {
        accessToken: string
        accountId: string
        deviceId: string
        displayName: string
        secret: string
      }

      accountDataSchema.parse(accountData)

      if (responseDevice) {
        await Authentication.registerAccount(
          ElectronAPIEventKeys.ResponseAuthWithAuthorization,
          accountData
        )
        await Authentication.createStoreAccess(accountData)

        return
      }
    } catch (error) {
      return Authentication.responseError({
        key: ElectronAPIEventKeys.ResponseAuthWithAuthorization,
        error,
      })
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ResponseAuthWithAuthorization,
      {
        accessToken: null,
        data: null,
        error: LauncherAuthError.login,
      }
    )
  }

  static async device(data: AuthenticationByDeviceProperties) {
    try {
      const responseDevice = await getAccessTokenUsingDeviceAuth(data)

      const accountData = {
        accessToken: responseDevice.data.access_token,
        accountId: responseDevice.data.account_id,
        deviceId: data.deviceId,
        displayName: responseDevice.data.displayName,
        secret: data.secret,
      } as {
        accessToken: string
        accountId: string
        deviceId: string
        displayName: string
        secret: string
      }

      accountDataSchema.parse(accountData)

      await Authentication.registerAccount(
        ElectronAPIEventKeys.ResponseAuthWithDevice,
        accountData
      )
      await Authentication.createStoreAccess(accountData)
    } catch (error) {
      Authentication.responseError({
        key: ElectronAPIEventKeys.ResponseAuthWithDevice,
        error,
      })
    }
  }

  static async exchange(code: string) {
    await Authentication.linkWithExchangeCode(
      code,
      ElectronAPIEventKeys.ResponseAuthWithExchange
    )
  }

  /**
   * Turns an exchange code into a linked account: default-client tokens,
   * fresh device auth credentials, saved, then reported on `key`. Shared by
   * the exchange code form and Quick login.
   */
  static async linkWithExchangeCode(
    code: string,
    key: ElectronAPIEventKeys
  ) {
    try {
      const responseExchange = await getAccessTokenUsingExchangeCode(code)
      const responseDevice =
        await Authentication.generateDeviceAuthCredencials(key, {
          accessToken: responseExchange.data.access_token,
          accountId: responseExchange.data.account_id,
        })

      const accountData = {
        accessToken: responseExchange.data.access_token,
        accountId: responseExchange.data.account_id,
        deviceId: responseDevice?.deviceId,
        displayName: responseExchange.data.displayName,
        secret: responseDevice?.secret,
      } as {
        accessToken: string
        accountId: string
        deviceId: string
        displayName: string
        secret: string
      }

      accountDataSchema.parse(accountData)

      if (responseDevice) {
        await Authentication.registerAccount(key, accountData)
        await Authentication.createStoreAccess(accountData)

        return
      }
    } catch (error) {
      return Authentication.responseError({
        key,
        error,
      })
    }

    MainWindow.instance.webContents.send(key, {
      accessToken: null,
      data: null,
      error: LauncherAuthError.login,
    })
  }

  static async generateExchangeCode(account: AccountData) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ResponseGenerateExchangeCode,
          {
            account,
            status: false,
            code: null,
          } as GenerateExchangeCodeNotificationCallbackResponseParam
        )

        return
      }

      const exchange = await getExchangeCodeUsingAccessToken(accessToken)

      if (exchange.data.code) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.ResponseGenerateExchangeCode,
          {
            account,
            status: true,
            code: exchange.data.code,
          } as GenerateExchangeCodeNotificationCallbackResponseParam
        )

        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/authentication.ts', error)
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.ResponseGenerateExchangeCode,
      {
        account,
        status: false,
        code: null,
      } as GenerateExchangeCodeNotificationCallbackResponseParam
    )
  }

  static async openEpicGamesSettings(account: AccountData) {
    try {
      const accessToken = await Authentication.verifyAccessToken(account)

      if (!accessToken) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.OpenEpicGamesSettingsNotification,
          {
            account,
            status: false,
          }
        )

        return
      }

      const exchange = await getExchangeCodeUsingAccessToken(accessToken)

      if (exchange.data.code) {
        MainWindow.instance.webContents.send(
          ElectronAPIEventKeys.OpenEpicGamesSettingsNotification,
          {
            account,
            code: exchange.data.code,
            status: true,
          } as EpicGamesSettingsNotificationCallbackResponseParam
        )

        return
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      RuntimeLog.error('caught:core/authentication.ts', error)
    }

    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.OpenEpicGamesSettingsNotification,
      {
        account,
        status: false,
      }
    )
  }

  static async verifyAccessToken(account: AccountData) {
    const currentAccount =
      AccountsManager.getAccountById(account.accountId) ?? account

    const syncAccessToken = (data: {
      accessToken: string | null
      authStatus: 'valid' | 'invalid'
      displayName: string
    }) => {
      const newData = {
        ...data,
        displayName: data.displayName ?? currentAccount.displayName,
      }

      AccountsManager.syncAccount(currentAccount.accountId, data)

      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.SyncAccessToken,
        {
          data: newData,
          accountId: currentAccount.accountId,
        } as SyncAccountDataResponse
      )
    }
    const generateAccessToken = async () => {
      const response = await getAccessTokenUsingDeviceAuth(currentAccount)
      const accessToken = response.data.access_token ?? null

      syncAccessToken({
        accessToken,
        authStatus: 'valid',
        displayName: response.data.displayName,
      })

      return accessToken
    }

    try {
      if (!currentAccount.accessToken) {
        const response = await generateAccessToken()

        return response
      }

      const response = await oauthVerify(currentAccount.accessToken)
      const accessToken = response.data.token ?? null

      syncAccessToken({
        accessToken,
        authStatus: 'valid',
        displayName: response.data.display_name,
      })

      return accessToken
    } catch (error) {
      if (
        (error as Record<string, { status: number }>).response?.status ===
        401
      ) {
        try {
          const response = await generateAccessToken()

          return response

          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          RuntimeLog.error('caught:core/authentication.ts', error)
        }
      }
    }

    syncAccessToken({
      accessToken: null,
      authStatus: 'invalid',
      displayName: currentAccount.displayName,
    })

    return null
  }

  static async checkAllAccounts() {
    const accounts = [...AccountsManager.getAccounts().values()]

    for (const account of accounts) {
      MainWindow.instance.webContents.send(
        ElectronAPIEventKeys.SyncAccessToken,
        {
          accountId: account.accountId,
          data: { authStatus: 'checking' },
        } as SyncAccountDataResponse
      )
    }

    await Promise.allSettled(
      accounts.map((account) => Authentication.verifyAccessToken(account))
    )
  }

  private static async createStoreAccess(accountData: AccountData) {
    try {
      const newAccessToken =
        await Authentication.verifyAccessToken(accountData)

      if (newAccessToken) {
        await Unlock.storeAccess({
          accessToken: newAccessToken,
          accountId: accountData.accountId,
        })
      }
    } catch (error) {
      RuntimeLog.error('caught:core/authentication.ts', error)
    }
  }

  private static async registerAccount(
    eventKey: ElectronAPIEventKeys,
    data: {
      accessToken: string
      accountId: string
      deviceId: string
      displayName: string
      secret: string
    }
  ) {
    const { accountId, deviceId, displayName, secret } = data
    const newData: AccountData = {
      accountId,
      authStatus: 'valid',
      deviceId,
      displayName,
      secret,
      provider: undefined,
      accessToken: undefined,
    }

    await AccountsManager.add({
      accountId,
      deviceId,
      displayName,
      secret,
    })

    const { accounts } = await DataDirectory.getAccountsFile()
    const accountList = accounts.reduce((accumulator, current) => {
      accumulator[current.accountId] = AccountsManager.toRenderer(current)

      return accumulator
    }, {} as AccountDataRecord)

    MainWindow.instance.webContents.send(eventKey, {
      data: {
        currentAccount: AccountsManager.toRenderer(newData),
        accounts: accountList,
      },
      accessToken: null,
      error: null,
    })
  }

  private static async generateDeviceAuthCredencials(
    key: ElectronAPIEventKeys,
    {
      accessToken,
      accountId,
    }: {
      accessToken: string
      accountId: string
    }
  ) {
    try {
      const response = await createDeviceAuthCredentials({
        accessToken,
        accountId,
      })

      return response.data
    } catch (error) {
      Authentication.responseError({
        key,
        error,
      })
    }

    return null
  }

  static responseError({
    error,
    key,
  }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any
    key: ElectronAPIEventKeys
  }) {
    MainWindow.instance.webContents.send(key, {
      accessToken: null,
      data: null,
      error:
        (error.response?.data as CommonErrorResponse)?.errorMessage ??
        LauncherAuthError.login,
    })
  }
}

/**
 * Quick login: Epic's device code grant, the same flow Penny's Discord bot
 * uses for `/login` → Quick.
 *
 * A Switch-client bootstrap token opens a device authorization; the user
 * approves it on epicgames.com while Penny polls; the resulting Switch token
 * is swapped for an exchange code, which links the account exactly like the
 * exchange code form does (default client, fresh device auth). Nothing to
 * paste, and no password ever passes through Penny.
 *
 * One attempt at a time: starting again or cancelling aborts the previous
 * poll. The device code stays in this process and is never logged.
 */
export class QuickLogin {
  private static attempt: AbortController | null = null

  static cancel() {
    if (!QuickLogin.attempt) {
      return
    }

    QuickLogin.attempt.abort()
    QuickLogin.attempt = null
    QuickLogin.status({ status: 'cancelled' })
  }

  static async start() {
    QuickLogin.attempt?.abort()

    const attempt = new AbortController()
    const { signal } = attempt
    const isCurrent = () => QuickLogin.attempt === attempt && !signal.aborted

    QuickLogin.attempt = attempt
    QuickLogin.status({ status: 'starting' })

    try {
      const bootstrap = await createAccessTokenUsingClientCredentials({
        authorization: nintendoSwitchGameClient.auth,
      })

      if (!isCurrent()) {
        return
      }

      const { data: authorization } = await createDeviceAuthorization(
        bootstrap.data.access_token,
        { signal }
      )
      const verificationUri = QuickLogin.safeVerificationUri(
        authorization.verification_uri_complete
      )

      if (!authorization.device_code || !verificationUri) {
        throw new Error('Epic returned an incomplete device authorization')
      }

      const expiresInSeconds = Math.min(
        authorization.expires_in > 0 ? authorization.expires_in : 300,
        quickLoginMaxSeconds
      )
      const expiresAt = Date.now() + expiresInSeconds * 1_000

      void shell.openExternal(verificationUri)
      QuickLogin.status({ status: 'waiting', verificationUri, expiresAt })

      const switchToken = await QuickLogin.poll({
        deviceCode: authorization.device_code,
        expiresAt,
        intervalSeconds:
          authorization.interval > 0
            ? authorization.interval
            : quickLoginDefaultIntervalSeconds,
        signal,
      })

      if (!isCurrent()) {
        return
      }

      if (!switchToken) {
        QuickLogin.attempt = null
        QuickLogin.status({ status: 'expired' })

        return
      }

      QuickLogin.status({ status: 'signing-in' })

      const exchange = await getExchangeCodeUsingDeviceCodeToken(
        switchToken,
        { signal }
      )

      if (!isCurrent()) {
        return
      }

      if (!exchange.data.code) {
        throw new Error('Epic returned no exchange code')
      }

      // Past this point the account is being written; cancel is a no-op.
      QuickLogin.attempt = null

      await Authentication.linkWithExchangeCode(
        exchange.data.code,
        ElectronAPIEventKeys.ResponseAuthWithQuickLogin
      )
    } catch (error) {
      if (!isCurrent()) {
        return
      }

      QuickLogin.attempt = null
      RuntimeLog.error(
        'caught:core/authentication.ts quick login',
        QuickLogin.describeError(error)
      )
      Authentication.responseError({
        key: ElectronAPIEventKeys.ResponseAuthWithQuickLogin,
        error,
      })
    }

    QuickLogin.status({ status: 'finished' })
  }

  /**
   * Resolves with the Switch access token once the user approves, or null
   * when the attempt expires or is aborted. Denial and other terminal errors
   * throw.
   */
  private static async poll({
    deviceCode,
    expiresAt,
    intervalSeconds,
    signal,
  }: {
    deviceCode: string
    expiresAt: number
    intervalSeconds: number
    signal: AbortSignal
  }) {
    let interval = intervalSeconds

    while (!signal.aborted) {
      await wait(interval * 1_000, signal)

      if (signal.aborted || Date.now() >= expiresAt) {
        return null
      }

      try {
        const response = await getAccessTokenUsingDeviceCode(deviceCode, {
          signal,
        })

        if (!response.data.access_token) {
          throw new Error('Epic returned no access token')
        }

        return response.data.access_token
      } catch (error) {
        if (signal.aborted) {
          return null
        }

        if (!isAxiosError(error)) {
          throw error
        }

        // No response: a network blip, not an answer. Keep going until the
        // deadline.
        if (!error.response) {
          continue
        }

        const errorCode =
          (error.response.data as Partial<CommonErrorResponse> | undefined)
            ?.errorCode ?? ''

        if (
          errorCode.endsWith('authorization_pending') ||
          errorCode === 'errors.com.epicgames.not_found'
        ) {
          continue
        }

        if (errorCode.endsWith('slow_down')) {
          interval += 5

          continue
        }

        if (errorCode.includes('expired')) {
          return null
        }

        throw error
      }
    }

    return null
  }

  /**
   * Only ever hand the OS an https epicgames.com page.
   */
  private static safeVerificationUri(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }

    try {
      const url = new URL(value)
      const host = url.hostname.toLowerCase()

      if (
        url.protocol === 'https:' &&
        (host === 'epicgames.com' || host.endsWith('.epicgames.com'))
      ) {
        return url.toString()
      }
    } catch {
      // Not a URL.
    }

    return null
  }

  /**
   * Axios errors carry the request (Authorization header, device code) —
   * log only what explains the failure.
   */
  private static describeError(error: unknown) {
    if (isAxiosError(error)) {
      const data = error.response?.data as
        | Partial<CommonErrorResponse>
        | undefined

      return {
        message: error.message,
        status: error.response?.status,
        errorCode: data?.errorCode,
      }
    }

    return error instanceof Error ? error.message : String(error)
  }

  private static status(value: QuickLoginStatusParam) {
    MainWindow.instance.webContents.send(
      ElectronAPIEventKeys.QuickLoginStatus,
      value
    )
  }
}

const quickLoginDefaultIntervalSeconds = 10
const quickLoginMaxSeconds = 15 * 60

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)

    signal.addEventListener('abort', done, { once: true })
  })
}
