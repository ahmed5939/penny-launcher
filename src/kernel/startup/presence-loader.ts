/**
 * The one way to load presence (and with it `ws`), shared by IPC and add-ons,
 * so quit knows whether there is a connection to close whoever opened it.
 */
let loaded = false

export function loadPresence() {
  return import('./presence').then((module) => {
    loaded = true
    return module
  })
}

export function presenceLoaded() {
  return loaded
}
