import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  it('should have default height of 400px', () => {
    const settings = new PluginSettings();

    expect(settings.defaultHeight).toBe('400px');
  });

  it('should have default width of 100%', () => {
    const settings = new PluginSettings();

    expect(settings.defaultWidth).toBe('100%');
  });
});
