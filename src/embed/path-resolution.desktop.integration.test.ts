import { registerPathResolutionSuite } from './path-resolution-shared.integration.test.ts';

// Desktop entry — runs on this Windows dev host now as the Windows-side proxy for GitHub issue #4
// (embedding an HTML file from another folder by a relative and a full vault path). The desktop
// transport in `obsidian-integration-testing` runs the HOST OS's Obsidian, so the identical suite runs
// against a real Linux Obsidian on a
// Linux CI runner via `path-resolution.linux.integration.test.ts` (verify both ends). The suite
// body lives in the shared `*-shared.integration.test.ts` module so neither entry duplicates it.
registerPathResolutionSuite('desktop');
