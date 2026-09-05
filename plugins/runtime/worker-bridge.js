// Worker-side transport; no DOM, Electron, Node or RTCPeerConnection globals.
(() => {
  let nextId = 0
  const pending = new Map()
  const listeners = new Set()
  globalThis.pennyBridge = {
    call(method, args) {
      if (pending.size >= 16) return Promise.reject(new Error('Too many pending host requests.'))
      const id = ++nextId
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        postMessage({ id, method, args })
      })
    },
    listen(callback) { listeners.add(callback); return () => listeners.delete(callback) },
  }
  addEventListener('message', ({ data }) => {
    if (data.type === 'response') {
      const item = pending.get(data.id)
      if (!item) return
      pending.delete(data.id)
      if (data.error) item.reject(new Error(data.error))
      else item.resolve(data.value)
    } else for (const listener of listeners) listener(data)
  })
})()
