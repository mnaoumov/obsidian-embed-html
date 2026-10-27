import { registerPathResolutionSuite } from './path-resolution-shared.integration.test.ts';

// LINUX-SPECIFIC entry for GitHub issue #4 — the reporter observes relative/absolute-path HTML embeds
// failing on Linux ONLY. The desktop transport in `obsidian-integration-testing` runs the HOST OS's
// Obsidian, so on a Linux CI runner
// `npm run test:integration:linux` exercises this suite against a real Linux Obsidian (case-sensitive
// ext4), which is the verification the report needs. This entry is deliberately NOT part of the default
// `npm run test:integration` sweep (see `scripts/test-integration.ts`) and CANNOT be validated on the
// Windows dev host where it was authored — running it here would launch a Windows Obsidian and prove
// nothing about Linux. PENDING a Linux CI runner, which is why it cannot be driven here yet.
registerPathResolutionSuite('linux');
