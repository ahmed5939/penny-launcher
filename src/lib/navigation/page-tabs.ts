import type { SearchSchemaInput } from '@tanstack/react-router'

/** Static page sections are validated at the route boundary. */
export function pageTabSearch<const T extends readonly string[]>(
  values: T,
  fallback: T[number],
) {
  return (
    search: SearchSchemaInput & { tab?: unknown },
  ): { tab: T[number] } => ({
    tab:
      typeof search.tab === 'string' && values.includes(search.tab)
        ? search.tab
        : fallback,
  })
}

/** Runtime collections use stable IDs and fall back when an item disappears. */
export function resolveCollectionSelection(
  ids: readonly string[],
  requested?: string,
  preferred?: string,
) {
  return requested && ids.includes(requested)
    ? requested
    : preferred && ids.includes(preferred)
      ? preferred
      : ids[0]
}
