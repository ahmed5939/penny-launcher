import type { ClassValue } from 'clsx'
import type { AccountData, AccountDataRecord } from '../types/accounts'

import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'


import { checkIfCustomDisplayNameIsValid } from './validations/properties'

/*
 * The named sizes from `tailwind.config.js`. Unregistered, tailwind-merge
 * reads `text-ui` as a colour and drops the real colour class beside it.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['3xs', '2xs', 'caption', 'ui', 'title', 'display-sm', 'display', 'display-lg'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sortAccounts(data: AccountDataRecord) {
  const result = Object.values(data)
  const accounts = result.toSorted((itemA, itemB) => {
    const _itemADisplayName = parseCustomDisplayName(itemA)
    const _itemBDisplayName = parseCustomDisplayName(itemB)

    return localeCompareForSorting(_itemADisplayName, _itemBDisplayName)
  })

  const accountList = accounts.reduce((accumulator, current) => {
    accumulator[current.accountId] = current

    return accumulator
  }, {} as AccountDataRecord)

  return accountList
}

export function parseCustomDisplayName(account?: AccountData | null) {
  if (!account) {
    return 'unknown-user'
  }

  const customDisplayNameText = checkIfCustomDisplayNameIsValid(
    account?.customDisplayName
  )
    ? `${account?.customDisplayName}`
    : `${account?.displayName}`

  return customDisplayNameText
}

/**
 *
 * @param max number. `Default: 100`
 * @returns random number
 */
export function randomNumber(max?: number) {
  return Math.floor(Math.random() * (max ?? 100))
}

export function localeCompareForSorting(valueA: string, valueB: string) {
  return valueA.localeCompare(valueB, undefined, {
    numeric: true,
  })
}
