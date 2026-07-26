import { defineConfig } from 'vitest/config';

const SHARED_EXCLUDE = ['node_modules', 'dist'];
const BIG_TIMEOUT_IN_MILLISECONDS = 30_000;
// A demo note can hold many lazily-rendered embeds plus several code buttons that each rebuild the
// Whole view on click, so a single note's walk-render-click cycle needs far more than a normal test.
const DEMO_VAULT_TIMEOUT_IN_MILLISECONDS = 180_000;
const ANDROID_TIMEOUT_IN_MILLISECONDS = 60_000;
const PERFORMANCE_TIMEOUT_IN_MILLISECONDS = 600_000;
const HOOK_TIMEOUT_MULTIPLIER = 4;

export const config = defineConfig({
  test: {
    coverage: {
      exclude: [
        'src/**/*.test.ts'
      ],
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage'
    },
    exclude: ['node_modules', 'dist'],
    globals: false,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    projects: [
      {
        resolve: {
          alias: {
            obsidian: 'obsidian-test-mocks/obsidian'
          }
        },
        test: {
          environment: 'jsdom',
          exclude: [...SHARED_EXCLUDE, 'src/**/*.integration.test.ts'],
          execArgv: ['--no-webstorage'],
          include: ['src/**/*.test.ts'],
          name: 'unit-tests',
          server: {
            deps: {
              inline: ['@obsidian-typings', 'obsidian-dev-utils']
            }
          },
          setupFiles: [
            'obsidian-test-mocks/vitest-setup',
            'obsidian-test-mocks/obsidian-typings/vitest-setup',
            'obsidian-dev-utils/vitest-setup'
          ]
        }
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
          include: ['src/**/*.no-app.integration.test.ts'],
          name: 'integration-tests:no-app',
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          // Project-specific: seeds the whole demo-vault (plus CST binary + config) before Obsidian
          // Opens, so its startup scan indexes every note and the code-buttons work with no network.
          globalSetup: ['./scripts/demo-vault-global-setup.ts'],
          hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
          include: ['src/**/*.demo-vault.integration.test.ts'],
          name: 'integration-tests:demo-vault',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: DEMO_VAULT_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
          hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
          include: ['src/**/*.desktop.integration.test.ts'],
          name: 'integration-tests:desktop',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          // CI-only knobs (this project runs ONLY on a Linux CI runner — see the `include` comment).
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
          fileParallelism: false,
          globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
          hookTimeout: BIG_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
          // Linux-specific entry for GitHub issue #4. Identical to `integration-tests:desktop` except the
          // Glob (and the CI knobs above), because OIT's desktop transport runs the HOST OS's Obsidian —
          // So this reproduces the Linux path-resolution behavior only when invoked
          // (`npm run test:integration:linux`) ON a Linux host (the `.github/workflows/integration-linux.yml`
          // Workflow runs it on `ubuntu-latest`). It is intentionally excluded from the default
          // `test:integration` sweep.
          include: ['src/**/*.linux.integration.test.ts'],
          name: 'integration-tests:linux',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: BIG_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
          hookTimeout: PERFORMANCE_TIMEOUT_IN_MILLISECONDS,
          include: ['src/**/*.desktop-performance.integration.test.ts'],
          name: 'integration-tests:desktop-performance',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: PERFORMANCE_TIMEOUT_IN_MILLISECONDS
        }
      },
      {
        test: {
          environment: 'node',
          environmentOptions: {
            obsidianTransport: {
              appiumUrl: 'http://localhost:4723',
              avdName: 'obsidian_test',
              type: 'obsidian-android-appium'
            }
          },
          fileParallelism: false,
          globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin'],
          hookTimeout: ANDROID_TIMEOUT_IN_MILLISECONDS * HOOK_TIMEOUT_MULTIPLIER,
          include: ['src/**/*.android.integration.test.ts'],
          name: 'integration-tests:android',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: ANDROID_TIMEOUT_IN_MILLISECONDS
        }
      }
    ]
  }
});
