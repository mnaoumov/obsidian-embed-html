import type { Linter } from 'eslint';

import { defineEslintConfigs } from 'obsidian-dev-utils/script-utils/linters/eslint-config';

export const configs: Linter.Config[] = [
  {
    ignores: ['coverage/**']
  },
  ...defineEslintConfigs(),
  {
    // `HtmlEmbedComponent` builds `<style>` elements inside its own sandboxed `<iframe>` document (not the Obsidian app DOM the rule guards), so the forbidden-elements rule does not apply here.
    files: ['src/html-embed-component.ts'],
    rules: {
      'obsidianmd/no-forbidden-elements': 'off'
    }
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'capitalized-comments': 'off',
      'no-restricted-syntax': 'off',
      'no-void': 'off',
      'obsidianmd/no-global-this': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'perfectionist/sort-classes': 'off',
      'perfectionist/sort-modules': 'off'
    }
  }
];
