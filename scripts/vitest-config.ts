import { defineObsidianPluginVitestConfig } from 'obsidian-dev-utils/script-utils/test-runners/vitest-config';

// A demo note can hold many lazily-rendered embeds plus several code buttons that each rebuild the
// Whole view on click, so a single note's walk-render-click cycle needs far more than a normal test.
const DEMO_VAULT_TIMEOUT_IN_MILLISECONDS = 180_000;

export const config = defineObsidianPluginVitestConfig({
  customProjects(context) {
    return [
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          // Project-specific: seeds the whole demo-vault (plus CST binary + config) before Obsidian
          // Opens, so its startup scan indexes every note and the code-buttons work with no network.
          globalSetup: ['./scripts/demo-vault-global-setup.ts'],
          hookTimeout: context.bigTimeoutInMilliseconds * context.hookTimeoutMultiplier,
          include: ['src/**/*.demo-vault.integration.test.ts'],
          name: 'integration-tests:demo-vault',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: DEMO_VAULT_TIMEOUT_IN_MILLISECONDS
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
          hookTimeout: context.bigTimeoutInMilliseconds * context.hookTimeoutMultiplier,
          // Linux-specific entry for GitHub issue #4. Identical to `integration-tests:desktop` except the
          // Glob (and the CI knobs above), because OIT's desktop transport runs the HOST OS's Obsidian —
          // So this reproduces the Linux path-resolution behavior only when invoked
          // (`npm run test:integration:linux`) ON a Linux host (the `.github/workflows/integration-linux.yml`
          // Workflow runs it on `ubuntu-latest`). It is intentionally excluded from the default
          // `test:integration` sweep.
          include: ['src/**/*.linux.integration.test.ts'],
          name: 'integration-tests:linux',
          setupFiles: ['obsidian-integration-testing/vitest-setup'],
          testTimeout: context.bigTimeoutInMilliseconds
        }
      }
    ];
  }
});
