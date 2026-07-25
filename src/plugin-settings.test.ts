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

  it('should not open in a new tab by default', () => {
    const settings = new PluginSettings();

    expect(settings.shouldOpenInNewTab).toBe(false);
  });

  it('should have no border, border radius or background by default', () => {
    const settings = new PluginSettings();

    expect(settings.border).toBe('');
    expect(settings.borderRadius).toBe('');
    expect(settings.background).toBe('');
  });
});
