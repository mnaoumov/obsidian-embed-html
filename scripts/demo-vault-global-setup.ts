import type { PopulateFilesParams } from 'obsidian-integration-testing';

import {
  existsSync,
  readFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';
import { createSetup } from 'obsidian-integration-testing/vitest-global-setup-plugin';

import { readDemoVaultTree } from './helpers/read-demo-vault-tree.ts';

const DATA_JSON_INDENT = 2;

// CodeScript Toolkit powers the demo notes' `code-button` blocks and the root-relative
// `require('/demoSetup.ts')` calls. In real use the in-vault `demo-vault-helper` plugin installs and
// Configures it from the community registry on first launch — a NETWORK step. The test seeds CST
// Directly from the copy the helper already installed into the in-repo demo vault, so the run is
// Hermetic (no GitHub fetch) and does not depend on `demo-vault-helper` running.
const CODE_SCRIPT_TOOLKIT_PLUGIN_ID = 'fix-require-modules';
const CODE_SCRIPT_TOOLKIT_BINARY_FILES = ['main.js', 'manifest.json', 'styles.css'];

// Mirrors demo-vault-helper's CST configuration (src/obsidian/demo-vault-helper.ts in that plugin).
// `modulesRoot` is what makes `/demoSetup.ts` resolve to `_assets/CodeScriptToolkit/demoSetup.ts`.
const CODE_SCRIPT_TOOLKIT_SETTINGS = {
  invocableScriptsFolder: 'Invocables',
  modulesRoot: '_assets/CodeScriptToolkit',
  shouldHandleProtocolUrls: true,
  startupScriptPath: 'startup.ts'
};

// The plugin-under-test (embed-html) is provisioned + enabled by the harness; CST is seeded here.
// Demo-vault-helper is intentionally omitted (its only job is the network install we replace).
const COMMUNITY_PLUGINS = ['embed-html', CODE_SCRIPT_TOOLKIT_PLUGIN_ID];

function populate(): PopulateFilesParams {
  const demoObsidianDir = join(getRootFolder() ?? process.cwd(), 'demo-vault', '.obsidian');
  const tree = readDemoVaultTree();

  // Carry over the committed vault config (preview-mode default, core plugins, appearance).
  for (const configFile of ['app.json', 'appearance.json', 'core-plugins.json']) {
    const configPath = join(demoObsidianDir, configFile);
    if (existsSync(configPath)) {
      tree[`.obsidian/${configFile}`] = readFileSync(configPath);
    }
  }
  tree['.obsidian/community-plugins.json'] = `${JSON.stringify(COMMUNITY_PLUGINS, null, DATA_JSON_INDENT)}\n`;

  // Seed the CST binary from the demo vault's local install (gitignored, placed there by
  // Demo-vault-helper). If it is missing, fail loudly with how to produce it rather than launching a
  // Half-configured vault whose buttons silently never execute.
  const cstDir = join(demoObsidianDir, 'plugins', CODE_SCRIPT_TOOLKIT_PLUGIN_ID);
  for (const binaryFile of CODE_SCRIPT_TOOLKIT_BINARY_FILES) {
    const binaryPath = join(cstDir, binaryFile);
    if (!existsSync(binaryPath)) {
      throw new Error(
        `CodeScript Toolkit is not installed in the demo vault (${binaryPath} missing). `
          + 'Open demo-vault/ in Obsidian once so demo-vault-helper installs it, then re-run.'
      );
    }
    tree[`.obsidian/plugins/${CODE_SCRIPT_TOOLKIT_PLUGIN_ID}/${binaryFile}`] = readFileSync(binaryPath);
  }
  tree[`.obsidian/plugins/${CODE_SCRIPT_TOOLKIT_PLUGIN_ID}/data.json`] = `${JSON.stringify(CODE_SCRIPT_TOOLKIT_SETTINGS, null, DATA_JSON_INDENT)}\n`;

  return tree;
}

// Pre-populates the whole `demo-vault/` tree (plus CST binary + config) before Obsidian opens, so its
// Startup scan indexes every note and CST loads configured on first launch. Used by
// `integration-tests:demo-vault`.
const { setup, teardown } = createSetup({ populate });

export {
  setup,
  teardown
};
