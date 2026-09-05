import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'

const [id, parent = 'plugins/local'] = process.argv.slice(2)
if (!id || !/^[a-z0-9-]{1,64}$/.test(id) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(id)) {
  console.error('Usage: npm run plugin:create -- my-plugin [parent-directory]')
  process.exit(1)
}
const directory = path.resolve(parent, id)
await mkdir(path.dirname(directory), { recursive: true })
try { await mkdir(directory) }
catch (error) {
  if (error.code !== 'EEXIST') throw error
  console.error(`Already exists: ${directory}. Choose a new id or parent directory.`)
  process.exit(1)
}
await writeFile(path.join(directory, 'plugin.json'), JSON.stringify({
  id, name: id, version: '1.0.0', apiVersion: 4, runtime: 'sandbox',
  description: 'Describe what this add-on does.', permissions: ['ui', 'notifications'],
  capabilities: ['notifications'], entry: 'main.js', readme: 'README.md',
}, null, 2) + '\n')
await writeFile(path.join(directory, 'penny.d.ts'), await readFile(new URL('../plugins/sdk/index.d.ts', import.meta.url)))
await writeFile(path.join(directory, 'main.js'), `// @ts-check
/** @type {import('./penny').Activate} */
async function activate(context) {
  await context.ui.register({
    panels: [{ id: 'welcome', title: 'Welcome', body: 'Your add-on is ready.' }],
    settings: [{ id: 'greeting', label: 'Greeting', type: 'text', default: 'Hello from Penny!' }],
    actions: [{ id: 'hello', label: 'Say hello', run: async () => {
      const settings = await context.ui.getSettings()
      await context.notifications.show('Hello', String(settings.greeting).slice(0, 1000))
    } }],
  })
}
module.exports = { activate }
`)
await writeFile(path.join(directory, 'README.md'), `# ${id}

Describe the purpose, usage, account scope, and side effects here.

## Access

Runs in Penny's sandbox. Requests UI contributions and desktop notifications.
No direct Node, filesystem, network or credential access.

## Installation

Use Add-ons → Import folder, review the requested access, and approve.
The card includes a greeting setting and a Say hello action.
Saved data lives in plugin-data/${id} and is retained when removed.

## Source

Add a public HTTPS source URL here and in plugin.json before publishing.
`)
console.log(`Created ${directory}. Validate with npm run plugin:validate -- "${directory}".`)
