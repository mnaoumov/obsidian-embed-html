import type { Linter } from 'eslint';

import { defineConfig } from 'eslint/config';
import { defineEslintConfigs } from 'obsidian-dev-utils/script-utils/linters/eslint-config';

export const configs: Linter.Config[] = defineEslintConfigs({
  customConfigs() {
    return defineConfig([
      {
        // The demo vault ships illustrative scripts that intentionally break lint rules; it is linted for markdown + spelling only.
        ignores: ['demo-vault/**']
      }
    ]);
  }
});
