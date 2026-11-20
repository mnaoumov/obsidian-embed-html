import type { App } from 'obsidian';

import {
  asCodeBlock,
  createFragmentWithCodeBlocks
} from '@mnaoumov/obsidian-lib/html-element';
import { Notice } from 'obsidian';

const START_NOTE_PATH = '00 Start.md';

// Run by `CodeScript Toolkit` on load (its `startupScriptPath` setting, which the `Demo Vault Helper`
// points here). Opens the start note so the vault needs no committed workspace and no manual setup.
export async function invoke(app: App): Promise<void> {
  new Notice(createFragmentWithCodeBlocks(`${asCodeBlock('Embed HTML')} demo vault ready`));

  const startNote = app.vault.getFileByPath(START_NOTE_PATH);
  if (startNote) {
    await app.workspace.getLeaf(false).openFile(startNote);
  }
}
