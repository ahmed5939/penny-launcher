import type { ForgeConfig } from '@electron-forge/shared-types'

import { MakerSquirrel } from '@electron-forge/maker-squirrel'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

import packageJson from './package.json'

const config: ForgeConfig = {
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
