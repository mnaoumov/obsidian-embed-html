import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';
import { test } from '@mnaoumov/typescript-dev-toolkit/test-runners/vitest';

// Runs the Linux-specific integration entry (`src/**/*.linux.integration.test.ts`). MUST be run on a
// Linux host: the obsidian-integration-testing desktop transport launches the host OS's Obsidian, so
// this only reproduces GitHub issue #4 on Linux when the host itself is Linux (see
// `path-resolution.linux.integration.test.ts`).
await wrapCliTask(() =>
  test({
    projects: ['integration-tests:linux']
  })
);
