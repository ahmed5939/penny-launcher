/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import '../globals.css'

const root = document.documentElement
const appearance = window.electronAPI.initialAppearance
const storedColorTheme = localStorage.getItem('penny-color-theme')

root.classList.add(appearance.resolved)

if (storedColorTheme) {
  root.dataset.theme = storedColorTheme
}

const isOverlay =
  new URLSearchParams(window.location.search).get('penny-overlay') === '1'

if (isOverlay) {
  document.body.dataset.pennyOverlay = 'true'
  void import('../overlay/app')
} else {
  void import('../app')
}
