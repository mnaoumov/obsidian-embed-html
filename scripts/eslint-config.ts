import type { Linter } from 'eslint';

import { defineEslintConfigs } from 'obsidian-dev-utils/script-utils/linters/eslint-config';

export const configs: Linter.Config[] = [
  {
    ignores: ['coverage/**']
  },
  ...defineEslintConfigs(),
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'capitalized-comments': 'off',
      'no-restricted-syntax': 'off',
      'no-void': 'off',
      'obsidianmd/no-global-this': 'off',
      'perfectionist/sort-classes': 'off',
      'perfectionist/sort-modules': 'off'
    }
  }
];
