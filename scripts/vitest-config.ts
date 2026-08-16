import type { ObsidianPluginVitestConfigContext } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';
import type { TestProjectConfiguration } from 'vitest/config';

import { defineObsidianPluginVitestConfig } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';

/**
 * The screenshot-capture suites (T461-P21) that write
 * `images/screenshots/screenshot-*.png`.
 *
 * They are named `*.desktop-capture.` / `*.android-capture.` rather than
 * `*.desktop.` / `*.android.` so they match NONE of the standard project globs.
 * That keeps them out of `npm run test:integration` entirely — capturing is an
 * explicit operation (`npm run capture:screenshots`), not something every test
 * run does. Folding them into the standard projects would rewrite ten PNGs on
 * every run and dirty the tree mid-release.
 */
const DESKTOP_CAPTURE_TEST_FILES = 'src/**/*.desktop-capture.integration.test.ts';
const ANDROID_CAPTURE_TEST_FILES = 'src/**/*.android-capture.integration.test.ts';

/**
 * The AVD the mobile shots are taken on: 900x1600 at density 320, which is
 * exactly the size the community store asks for, so the capture needs no crop,
 * no rescale and no letterbox. The shared `obsidian_test` AVD is a Pixel 10 Pro
 * XL at 1344x2994 (~9:20) and cannot produce it; resizing that one at runtime
 * destroys the Appium session, because the display change recreates the
 * activity and with it the WebView the session is attached to.
 *
 * Needs one-time provisioning — see [[T461-P21]].
 */
const SCREENSHOT_AVD_NAME = 'obsidian_screenshots';

const APPIUM_URL = 'http://localhost:4723';

/**
 * This AVD is cold-booted and rarely used, so Obsidian's first layout on it is
 * far slower than on the well-warmed shared one; the 90s default expires while
 * it is still starting up.
 */
const LAYOUT_READY_TIMEOUT_IN_MILLISECONDS = 240_000;

/**
 * The demo-vault suites. They drive a real desktop Obsidian like the desktop
 * project, but open a copy of the in-repo `demo-vault/` rather than an empty
 * vault — hence their own `globalSetup` — and need their own suffix so the
 * desktop project does not also collect them and open them against a vault with
 * no notes in it.
 */
const DEMO_VAULT_TEST_FILES = 'src/**/*.demo-vault.integration.test.ts';

/**
 * A demo note can hold many lazily-rendered embeds plus several code buttons
 * that each rebuild the whole view on click, and one `it` here is a whole note —
 * so a single note's walk-render-click cycle needs far more than the 30s a
 * normal desktop test gets.
 */
const DEMO_VAULT_TIMEOUT_IN_MILLISECONDS = 180_000;

/**
 * Linux-specific entry for GitHub issue #4. Identical to
 * `integration-tests:desktop` except the glob (and the CI knobs below), because
 * OIT's desktop transport runs the HOST OS's Obsidian — so this reproduces the
 * Linux path-resolution behavior only when invoked
 * (`npm run test:integration:linux`) ON a Linux host (the
 * `.github/workflows/integration-linux.yml` workflow runs it on
 * `ubuntu-latest`). It is intentionally excluded from the default
 * `test:integration` sweep.
 */
const LINUX_TEST_FILES = 'src/**/*.linux.integration.test.ts';

export const config = defineObsidianPluginVitestConfig({
  customProjects(context: ObsidianPluginVitestConfigContext): TestProjectConfiguration[] {
    return [
      {
        test: {
          ...context.desktop,
          include: [DESKTOP_CAPTURE_TEST_FILES],
          name: 'capture-screenshots:desktop'
        }
      },
      {
        test: {
          ...context.android,
          environmentOptions: {
            obsidianTransport: {
              appiumUrl: APPIUM_URL,
              avdName: SCREENSHOT_AVD_NAME,
              layoutReadyTimeoutInMilliseconds: LAYOUT_READY_TIMEOUT_IN_MILLISECONDS,
              type: 'obsidian-android-appium'
            }
          },
          include: [ANDROID_CAPTURE_TEST_FILES],
          name: 'capture-screenshots:android'
        }
      },
      {
        test: {
          ...context.desktop,
          // Project-specific: seeds the whole demo-vault (plus the CodeScript Toolkit binary and its
          // Config) before Obsidian opens, so its startup scan indexes every note and the code-buttons
          // Work with no network.
          globalSetup: ['./scripts/demo-vault-global-setup.ts'],
          include: [DEMO_VAULT_TEST_FILES],
          name: 'integration-tests:demo-vault',
          testTimeout: DEMO_VAULT_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          ...context.desktop,
          // CI-only knobs (this project runs ONLY on a Linux CI runner — see `LINUX_TEST_FILES`).
          // A runner has no installed Obsidian, so pin the public-latest installer shell for OIT to
          // Download + extract the portable Linux `.tar.gz`; and disable the Chromium setuid sandbox
          // Because the extracted shell has no root-owned `chrome-sandbox` helper and CI runs as a
          // Non-root user (the renderer otherwise refuses to start). Both are no-ops on the download
          // Path OIT built for CI (`resolveInstalledShellOrNull`). Needs a `GITHUB_TOKEN` in the env
          // To lift the anonymous rate limit when resolving/downloading the release asset.
          environmentOptions: {
            obsidianTransport: {
              obsidianInstallerVersion: 'public-latest',
              shouldDisableSandbox: true,
              type: 'obsidian-cdp'
            }
          },
          include: [LINUX_TEST_FILES],
          name: 'integration-tests:linux'
        }
      }
    ];
  }
});
