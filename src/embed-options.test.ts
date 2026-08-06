import {
  describe,
  expect,
  it
} from 'vitest';

import { parseEmbedToken } from './embed-options.ts';

describe('parseEmbedToken', () => {
  it('should report no flags and pass an empty token through', () => {
    expect(parseEmbedToken('')).toEqual({
      options: { shouldOpenInSystemBrowser: null },
      sizeToken: ''
    });
  });

  it('should pass a short-form sizing token through untouched', () => {
    for (const token of ['600x-', '-', '50%', '400']) {
      expect(parseEmbedToken(token)).toEqual({
        options: { shouldOpenInSystemBrowser: null },
        sizeToken: token
      });
    }
  });

  it('should pass sizing declarations through untouched', () => {
    const token = 'width: max-content; min-width: 100px';
    expect(parseEmbedToken(token)).toEqual({
      options: { shouldOpenInSystemBrowser: null },
      sizeToken: token
    });
  });

  it('should take the open-in-default-browser flag out of the token', () => {
    expect(parseEmbedToken('open-in-default-browser: true')).toEqual({
      options: { shouldOpenInSystemBrowser: true },
      sizeToken: ''
    });
  });

  it('should read the flag as false when it says so', () => {
    expect(parseEmbedToken('open-in-default-browser: false')).toEqual({
      options: { shouldOpenInSystemBrowser: false },
      sizeToken: ''
    });
  });

  it('should accept the other spellings of each boolean', () => {
    for (const value of ['true', 'yes', 'on', '1', 'TRUE', ' True ']) {
      expect(parseEmbedToken(`open-in-default-browser: ${value}`).options.shouldOpenInSystemBrowser).toBe(true);
    }
    for (const value of ['false', 'no', 'off', '0', 'FALSE', ' Off ']) {
      expect(parseEmbedToken(`open-in-default-browser: ${value}`).options.shouldOpenInSystemBrowser).toBe(false);
    }
  });

  it('should ignore a value that names neither boolean, leaving the global setting in charge', () => {
    expect(parseEmbedToken('open-in-default-browser: maybe').options.shouldOpenInSystemBrowser).toBeNull();
  });

  it('should keep the sizing declarations when the token mixes both', () => {
    expect(parseEmbedToken('width: 600px; open-in-default-browser: true; height: -')).toEqual({
      options: { shouldOpenInSystemBrowser: true },
      sizeToken: 'width: 600px; height: -'
    });
  });

  it('should match the property case-insensitively and ignore surrounding space', () => {
    expect(parseEmbedToken('  Open-In-Default-Browser : true ').options.shouldOpenInSystemBrowser).toBe(true);
  });

  it('should let the last flag win when the token repeats it', () => {
    expect(parseEmbedToken('open-in-default-browser: true; open-in-default-browser: false').options.shouldOpenInSystemBrowser).toBe(false);
  });

  it('should keep a piece that carries no colon at all, alongside one that does', () => {
    expect(parseEmbedToken('600x-; open-in-default-browser: true')).toEqual({
      options: { shouldOpenInSystemBrowser: true },
      sizeToken: '600x-'
    });
  });

  it('should keep an unrecognized declaration in the size token, where the size parser drops it', () => {
    expect(parseEmbedToken('color: red; open-in-default-browser: true')).toEqual({
      options: { shouldOpenInSystemBrowser: true },
      sizeToken: 'color: red'
    });
  });
});
