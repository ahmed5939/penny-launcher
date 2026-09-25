import type { AxiosRequestConfig } from 'axios'
import type {
  AuthorizationCodeResponse,
  CreateAccessTokenWithClientCredentialsResponse,
  CreateExchangeCodeResponse,
  DeviceAuthorizationResponse,
  DeviceAuthResponse,
  ExchangeCodeResponse,
  VerifyAccessTokenResponse,
} from '../../types/services/authorizations'

import { nintendoSwitchGameClient } from '../../config/fortnite/clients'

import { oauthService } from '../config/oauth'
import { publicAccountService } from '../config/public-account'

export function getAccessTokenUsingAuthorizationCode(code: string) {
  return oauthService.post<AuthorizationCodeResponse>('/token', {
    grant_type: 'authorization_code',
    code,
  })
}

export function getAccessTokenUsingExchangeCode(
  exchange_code: string,
  config?: AxiosRequestConfig,
) {
  return oauthService.post<ExchangeCodeResponse>(
    '/token',
    {
      grant_type: 'exchange_code',
      exchange_code,
    },
    config,
  )
}

export function createAccessTokenUsingExchange(
  {
    exchange_code,
    token_type,
  }: {
    exchange_code: string
    token_type?: string
  },
  config?: AxiosRequestConfig,
) {
  return oauthService.post<AuthorizationCodeResponse>(
    '/token',
    {
      grant_type: 'exchange_code',
      exchange_code,
      token_type,
    },
    config,
  )
}

export function getAccessTokenUsingDeviceAuth(
  {
    accountId,
    deviceId,
    secret,
    token_type,
  }: {
    accountId: string
    deviceId: string
    secret: string
    token_type?: string
  },
  config?: AxiosRequestConfig,
) {
  return oauthService.post<AuthorizationCodeResponse>(
    '/token',
    {
      secret,
      grant_type: 'device_auth',
      account_id: accountId,
      device_id: deviceId,
      token_type,
    },
    config,
  )
}

export function getExchangeCodeUsingAccessToken(accessToken: string) {
  return oauthService.get<CreateExchangeCodeResponse>('/exchange', {
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

export function getExchangeCode(config: AxiosRequestConfig) {
  return oauthService.get<CreateExchangeCodeResponse>('/exchange', config)
}

export function createAccessTokenUsingClientCredentials({
  authorization,
}: {
  authorization: string
}) {
  return oauthService.post<CreateAccessTokenWithClientCredentialsResponse>(
    '/token',
    {
      grant_type: 'client_credentials',
    },
    {
      headers: {
        Authorization: `basic ${authorization}`,
      },
    },
  )
}

/**
 * Quick login (device code grant). Epic only serves the device authorization
 * and its polling from the prod03 account host, and only for the Switch
 * client.
 */

const oauthProd03BaseURL =
  'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth'

export function createDeviceAuthorization(
  bootstrapAccessToken: string,
  config?: AxiosRequestConfig
) {
  return oauthService.post<DeviceAuthorizationResponse>(
    '/deviceAuthorization',
    {},
    {
      ...config,
      baseURL: oauthProd03BaseURL,
      headers: {
        Authorization: `bearer ${bootstrapAccessToken}`,
      },
    }
  )
}

export function getAccessTokenUsingDeviceCode(
  device_code: string,
  config?: AxiosRequestConfig
) {
  return oauthService.post<AuthorizationCodeResponse>(
    '/token',
    {
      grant_type: 'device_code',
      device_code,
    },
    {
      ...config,
      baseURL: oauthProd03BaseURL,
      headers: {
        Authorization: `basic ${nintendoSwitchGameClient.auth}`,
      },
    }
  )
}

export function getExchangeCodeUsingDeviceCodeToken(
  accessToken: string,
  config?: AxiosRequestConfig
) {
  return oauthService.get<CreateExchangeCodeResponse>('/exchange', {
    ...config,
    baseURL: oauthProd03BaseURL,
    headers: {
      Authorization: `bearer ${accessToken}`,
    },
  })
}

export function createDeviceAuthCredentials({
  accessToken,
  accountId,
}: {
  accessToken: string
  accountId: string
}) {
  return publicAccountService.post<DeviceAuthResponse>(
    `/${accountId}/deviceAuth`,
    {},
    {
      headers: {
        Authorization: `bearer ${accessToken}`,
      },
    },
  )
}

export function oauthVerify(
  accessToken: string,
  config?: AxiosRequestConfig,
) {
  return oauthService.get<
    Omit<VerifyAccessTokenResponse, 'access_token'> & {
      token: string
    }
  >('/verify', {
    ...(config ?? {}),
    headers: {
      ...config?.headers,
      Authorization: `bearer ${accessToken}`,
    },
  })
}

export function killSession(token: string, config?: AxiosRequestConfig) {
  return oauthService.delete(`/sessions/kill/${token}`, config)
}
