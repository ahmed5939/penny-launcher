/// <reference types="vite/client" />

import type { BackendModule, ReadCallback } from 'i18next'

/**
 * Lazy i18next backend.
 *
 * `import.meta.glob` (without `eager`) leaves every translation file as its
 * own chunk instead of inlining all seven languages into the entry bundle.
 * The renderer therefore parses ~1/7th of the locale data on boot and fetches
 * the rest only if the user actually switches language.
 */
const files = import.meta.glob<{ default: Record<string, unknown> }>(
  './*/**/*.json'
)

const jsonSuffix = '.json'

/**
 * Namespaces whose backing file is not named after the namespace itself.
 */
const namespaceFileNames: Record<string, string> = {
  alerts: 'home',
}

async function loadNamespace(language: string, namespace: string) {
  /**
   * Directory-backed namespace: each file inside becomes a key, so
   * `stw-operations/auto-kick.json` resolves to `stw-operations:auto-kick.*`.
   */
  const directory = `./${language}/${namespace}/`
  const nested = Object.entries(files).filter(([path]) =>
    path.startsWith(directory)
  )

  if (nested.length > 0) {
    const entries = await Promise.all(
      nested.map(async ([path, load]) => {
        const key = path.slice(directory.length, -jsonSuffix.length)

        return [key, (await load()).default] as const
      })
    )

    return Object.fromEntries(entries)
  }

  const fileName = namespaceFileNames[namespace] ?? namespace
  const load = files[`./${language}/${fileName}${jsonSuffix}`]

  return load ? (await load()).default : null
}

export const lazyResourcesBackend: BackendModule = {
  type: 'backend',
  init() {
    // No configuration needed: the glob is resolved at build time.
  },
  read(language, namespace, callback: ReadCallback) {
    loadNamespace(language, namespace)
      .then((data) => {
        callback(null, data ?? {})
      })
      .catch((error: unknown) => {
        callback(error as Error, false)
      })
  },
}
