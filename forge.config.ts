import type { ForgeConfig } from '@electron-forge/shared-types'

import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

import { cp, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import packageJson from './package.json'

const windowsCertificateFile =
  process.env.PENNY_WINDOWS_CERTIFICATE_FILE
const windowsCertificatePassword =
  process.env.PENNY_WINDOWS_CERTIFICATE_PASSWORD
const windowsSigning = windowsCertificateFile
  ? {
      certificateFile: windowsCertificateFile,
      certificatePassword: windowsCertificatePassword,
    }
  : null

/**
 * Copy the main process's runtime dependencies into the packaged app.
 *
 * plugin-vite ≥7.4 packages only the Vite output — node_modules never make
 * it in. The renderer bundles everything it uses, but the main-process
 * build externalizes production dependencies (vite.base.config.ts), so its
 * bundles still `require()` them from disk. The list is read off the built
 * bundles rather than package.json, so it stays exact: renderer-only
 * libraries never ship, and a new kernel import can't be forgotten here.
 * Copying from the project's node_modules — not reinstalling — keeps native
 * binaries and ps-list's Windows process-listing executable intact.
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
      /(?:require|import)\(["']([^"'./][^"']*)["']\)/g
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
      /**
       * Compiler toolchains nested inside native modules are install-time
       * only; genuine nested runtime dependencies have ordinary names and
       * pass through.
       */
      filter: (fileSource) => {
        const segments = path
          .relative(root, fileSource)
          .split(path.sep)

        return !segments.some(
          (segment) =>
            segment === 'nw-gyp' ||
            segment === 'node-gyp' ||
            segment === '.bin'
        )
      },
    })

    const manifest = JSON.parse(manifestRaw) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }

    queue.push(
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
      /**
       * Peers ship only when the app itself declares them. Kernel code
       * imports enums from renderer state files, which drags zustand into
       * the main bundle — and zustand's entry does require('react'), a
       * peer. Unconditional peer-chasing is what shipped 100 MB of
       * @swc/core, so the app's dependency list is the gate.
       */
      ...Object.keys(manifest.peerDependencies ?? {}).filter(
        (peer) => peer in dependencies
      )
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
    /**
     * AutoUnpackNativesPlugin adds the glob for native `.node` files, but
     * sharp's Windows addon also loads libvips DLLs from the same directory.
     * DLLs cannot be loaded from inside app.asar, so unpack them alongside
     * sharp-win32-*.node. Without this, packaged Windows builds fail during
     * startup with ERR_DLOPEN_FAILED even though the addon itself is present.
     */
    asar: {
      unpack: '**/node_modules/@img/sharp-win32-*/lib/*.dll',
    },
    icon: 'icon-transparent.ico',
    ...(windowsSigning ? { windowsSign: windowsSigning } : {}),
    /**
     * Marketplace packages are plain, readable CommonJS folders. They must
     * stay as real files on disk so users can inspect their README and source
     * before choosing to install them.
     */
    extraResource: ['./plugins', './endurance-assets'],
  },
  /**
   * Both native dependencies ship Node-API prebuilds: sharp and uiohook-napi.
   * Node-API binaries are independent of Electron's module ABI, so rebuilding
   * them is unnecessary and makes Forge fall back to a local node-gyp
   * toolchain. An explicit empty allow-list is important: omitting
   * `onlyModules` tells @electron/rebuild to discover and compile everything.
   */
  rebuildConfig: {
    onlyModules: [],
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
      ...(windowsSigning ?? {}),
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
        {
          entry: 'src/kernel/overlay-preload.ts',
          config: 'vite.preload.config.ts',
        },
        {
          entry: 'src/kernel/locker-card-worker.ts',
          config: 'vite.main.config.ts',
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
