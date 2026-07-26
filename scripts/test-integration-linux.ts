import { wrapCliTask } from 'obsidian-dev-utils/script-utils/cli-utils';
import { test } from 'obsidian-dev-utils/script-utils/test-runners/vitest';

// Runs the Linux-specific integration entry (`src/**/*.linux.integration.test.ts`). MUST be run on a
// Linux host: OIT's desktop transport launches the host OS's Obsidian, so this only reproduces GitHub
// Issue #4 on Linux when the host itself is Linux (see `path-resolution.linux.integration.test.ts`).
await wrapCliTask(() =>
  test({
    projects: ['integration-tests:linux']
  })
);
