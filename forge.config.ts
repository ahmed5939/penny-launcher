import type { ForgeConfig } from '@electron-forge/shared-types'

import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

import { cp, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import packageJson from './package.json'

/**
 * Copy the main process's runtime dependencies into the packaged app.
 *
 * plugin-vite ≥7.4 packages only the Vite output — node_modules never make
 * it in. The renderer bundles everything it uses, but the main-process
 * build externalizes production dependencies (vite.base.config.ts), so its
 * bundles still `require()` them from disk. The list is read off the built
 * bundles rather than package.json, so it stays exact: renderer-only
 * libraries never ship, and a new kernel import can't be forgotten here.
 * Copying from the project's node_modules — not reinstalling — keeps the
 * electron-rebuilt native binaries (node-process-watcher) intact.
 * Peer dependencies are deliberately not followed; they exist for hosts,
 * and chasing them is how 100 MB of @swc/core ends up in an installer.
 */
async function copyMainProcessDependencies(buildPath: string) {
  const root = path.dirname(__filename)
  const dependencies: Record<string, string> = packageJson.dependencies

  const buildDir = path.join(buildPath, '.vite', 'build')
  const required = new Set<string>()

  for (const file of await readdir(buildDir)) {
    if (!file.endsWith('.js')) {
      continue
    }

    const bundle = await readFile(path.join(buildDir, file), 'utf8')

    for (const match of bundle.matchAll(
      /require\(["']([^"'./][^"']*)["']\)/g
    )) {
      const id = match[1]

      if (id.startsWith('node:')) {
        continue
      }

      const name = id.startsWith('@')
        ? id.split('/').slice(0, 2).join('/')
        : id.split('/')[0]

      // Externals are always declared dependencies; anything else here is
      // a builtin ('fs', 'electron') or an optional probe inside a dep.
      if (name in dependencies) {
        required.add(name)
      }
    }
  }

  const queue = [...required]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const name = queue.shift()!

    if (seen.has(name) || name === 'electron') {
      continue
    }

    seen.add(name)

    const source = path.join(root, 'node_modules', name)
    let manifestRaw: string

    try {
      manifestRaw = await readFile(
        path.join(source, 'package.json'),
        'utf8'
      )
    } catch {
      // Optional or platform-specific dependency that was never installed.
      continue
    }

    await cp(source, path.join(buildPath, 'node_modules', name), {
      recursive: true,
    })

    const manifest = JSON.parse(manifestRaw) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
    }

    queue.push(
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {})
    )
  }
}

const config: ForgeConfig = {
  hooks: {
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      await copyMainProcessDependencies(buildPath)
    },
  },
  packagerConfig: {
    asar: true,
    icon: 'icon-transparent.ico',
    /**
     * Marketplace packages are plain, readable CommonJS folders. They must
     * stay as real files on disk so users can inspect their README and source
     * before choosing to install them.
     */
    extraResource: ['./plugins', './endurance-assets'],
  },
  /**
   * sharp and uiohook-napi are N-API modules shipping prebuilt binaries, so
   * they run under Electron without a rebuild — and this machine has no
   * Python/MSVC toolchain, so letting @electron/rebuild fall back to
   * node-gyp on them kills `npm start`. Only node-process-watcher (a
   * prebuild-install module, which rebuild resolves by download) stays in.
   */
  rebuildConfig: {
    onlyModules: ['node-process-watcher'],
  },
  makers: [
    new MakerSquirrel({
      /**
       * Squirrel only accepts a remote URL here — it becomes the
       * Add/Remove Programs icon, so it must stay reachable from installed
       * machines, not just at build time.
       */
      iconUrl:
        'https://raw.githubusercontent.com/ahmed5939/penny-launcher/main/icon-transparent.ico',
      setupIcon: 'icon-transparent.ico',
    }),
  ],
  plugins: [
    /**
     * sharp and uiohook-napi (used by the endurance plugin) load native
     * .node binaries, which cannot run from inside the asar archive.
     */
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/kernel/main.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/kernel/preload.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        draft: true,
        generateReleaseNotes: true,
        prerelease: false,
        /**
         * Must match the repo the release workflow runs in — its
         * GITHUB_TOKEN cannot publish anywhere else. `author.name` stays
         * Ciensprog for upstream attribution, so don't derive owner from it.
         */
        repository: {
          owner: 'ahmed5939',
          name: packageJson.name,
        },
      },
    },
  ],
}

export default config
