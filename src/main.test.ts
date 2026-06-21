import {
  describe,
  expect,
  it
} from 'vitest';

import Plugin from './main.ts';
import { Plugin as PluginClass } from './plugin.ts';

describe('main', () => {
  it('should export Plugin as default export', () => {
    expect(Plugin).toBe(PluginClass);
  });
});
