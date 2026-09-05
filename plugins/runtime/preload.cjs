// Trusted host preload. Plugin code never runs in this isolated world.
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('pennyBridge', {
  call: (method, args) => ipcRenderer.invoke('penny:sandbox:call', method, args),
  listen: (callback) => {
    const listener = (_event, message) => callback(message)
    ipcRenderer.on('penny:sandbox:message', listener)
    return () => ipcRenderer.removeListener('penny:sandbox:message', listener)
  },
})
