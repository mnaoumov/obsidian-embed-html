import { registerDemoVaultButtonSuite } from 'obsidian-dev-utils/script-utils/demo-vault-buttons';

// Clicks every `code-button` in `demo-vault/` against a real Obsidian. A button's failure is a runtime
// One at click time — a wrong `require('/demoSetup.ts')` path, or an API that changed shape under it —
// So no other gate in this repo can catch it: `lint:md` reads the markdown and the coverage suite
// Checks the authoring conventions, and neither executes anything.
//
// The embed-specific half of this vault's checks (every embed resolves, and a declared numeric size
// Actually renders at that many pixels) is `demo-vault-embeds.demo-vault.integration.test.ts`.
//
// Isolation: `npx vitest run --project integration-tests:demo-vault`.
registerDemoVaultButtonSuite();
