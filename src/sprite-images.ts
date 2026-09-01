/**
 * The bundled sprite art.
 *
 * The relic backend never sends a picture, and the community CDN that has
 * them is not something a desktop app should lean on at runtime, so the
 * icons ship inside the app. `data/sprites.json` names a file per treatment
 * (`water_gold.webp`) and this resolves it to the built asset URL.
 */

const icons = import.meta.glob<string>(
  '../assets/images/sprites/*.webp',
  { eager: true, import: 'default' }
)

export function spriteIconUrl(fileName: string | null) {
  if (!fileName) {
    return null
  }

  return icons[`../assets/images/sprites/${fileName}`] ?? null
}
