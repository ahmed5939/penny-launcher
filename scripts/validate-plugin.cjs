// Runs host validation and syntax parsing only. Never executes plugin code.
require('ts-node').register({
  transpileOnly: true, skipProject: true,
  compilerOptions: { module: 'CommonJS', moduleResolution: 'node', target: 'ES2022' },
})
const { Script } = require('node:vm')
const { inspectPlugin } = require('../src/kernel/startup/plugin-package.ts')
async function main() {
  const directory = process.argv[2]
  if (!directory) throw new Error('Usage: npm run plugin:validate -- path/to/plugin')
  const pkg = await inspectPlugin(directory)
  if (pkg.manifest.runtime !== 'sandbox') throw new Error('Set runtime to sandbox and migrate Node/Electron APIs.')
  if (pkg.manifest.apiVersion !== 4) throw new Error('Declare apiVersion: 4 for the sandbox SDK.')
  new Script(pkg.source, { filename: pkg.manifest.entry ?? 'main.js' })
  console.log(`Valid package: ${pkg.manifest.id} ${pkg.manifest.version ?? ''}\nSHA-256: ${pkg.digest}\nPermissions: ${(pkg.manifest.permissions ?? []).join(', ') || 'none'}`)
  if (!pkg.manifest.repository) console.log('Before publishing: add a public HTTPS repository URL.')
  if (/\brequire\s*\(/.test(pkg.source)) console.log('Review: require() is unavailable in the sandbox. Bundle browser-compatible dependencies into the entry file.')
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
