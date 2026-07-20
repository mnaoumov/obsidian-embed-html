import process from 'node:process';
import { registerDemoVaultCoverageSuite } from 'obsidian-dev-utils/script-utils/demo-vault-coverage';
import { getRootFolder } from 'obsidian-dev-utils/script-utils/root';

// Keeps the in-repo `demo-vault/` in sync with the plugin's public surface WITHOUT launching Obsidian.
// Reads the real settings from source and asserts every setting is demonstrated in some note.
// Also asserts no note references a setting that no longer exists (guards against rename drift).
// Runtime behavior of the plugin itself is covered by the other integration tests, not the demo vault.
registerDemoVaultCoverageSuite({
  configInterfaces: [{ interfaceName: 'PluginSettings', sourcePath: 'src/plugin-settings.ts' }],
  interfaces: [{
    interfaceName: 'PluginSettings',
    kind: 'properties',
    receiver: 'settings',
    sourcePath: 'src/plugin-settings.ts'
  }],
  nonTrivialGuard: {
    expectDemoNote: '02 Custom Size.md',
    expectMember: 'defaultHeight',
    interfaceName: 'PluginSettings',
    sourcePath: 'src/plugin-settings.ts'
  },
  rootFolder: getRootFolder() ?? process.cwd()
});
