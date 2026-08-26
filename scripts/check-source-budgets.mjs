import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const sourceRoot = path.resolve('src')
const maxSourceBytes = 250_000
const failures = []

async function visit(directory) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name)

      if (entry.isDirectory()) return visit(filePath)
      if (!/\.(?:ts|tsx)$/.test(entry.name)) return

      const [{ size }, content] = await Promise.all([
        stat(filePath),
        readFile(filePath, 'utf8'),
      ])
      const relative = path.relative(process.cwd(), filePath)

      if (size > maxSourceBytes) {
        failures.push(`${relative} is ${size} bytes (limit: ${maxSourceBytes}).`)
      }

      if (/data:image\/(?:gif|jpeg|png|svg\+xml|webp);base64,/i.test(content)) {
        failures.push(`${relative} embeds a base64 image.`)
      }
    })
  )
}

await visit(sourceRoot)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('Source budgets passed.')
}
