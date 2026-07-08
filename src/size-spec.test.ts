import {
  describe,
  expect,
  it
} from 'vitest';

import type { SizeSpec } from './size-spec.ts';

import {
  getContentKeyword,
  parseSizeSpec
} from './size-spec.ts';

const EMPTY: SizeSpec = {
  height: null,
  maxHeight: null,
  maxWidth: null,
  minHeight: null,
  minWidth: null,
  width: null
};

describe('parseSizeSpec', () => {
  describe('empty / unrecognized tokens', () => {
    it('should return an all-null spec for an empty token', () => {
      expect(parseSizeSpec('')).toEqual(EMPTY);
    });

    it('should return an all-null spec for a whitespace-only token', () => {
      expect(parseSizeSpec('   ')).toEqual(EMPTY);
    });
  });

  describe('short form', () => {
    it('should treat a bare value as width', () => {
      expect(parseSizeSpec('50%')).toEqual({ ...EMPTY, width: '50%' });
    });

    it('should append px to a bare pure number width', () => {
      expect(parseSizeSpec('600')).toEqual({ ...EMPTY, width: '600px' });
    });

    it('should keep an explicit unit on a bare width', () => {
      expect(parseSizeSpec('30em')).toEqual({ ...EMPTY, width: '30em' });
    });

    it('should treat a bare dash as fit-content height with default width', () => {
      expect(parseSizeSpec('-')).toEqual({ ...EMPTY, height: 'fit-content' });
    });

    it('should parse WxH with pure numbers as px', () => {
      expect(parseSizeSpec('600x400')).toEqual({ ...EMPTY, height: '400px', width: '600px' });
    });

    it('should parse WxH with mixed units', () => {
      expect(parseSizeSpec('50%x300')).toEqual({ ...EMPTY, height: '300px', width: '50%' });
    });

    it('should parse fixed width and fit-content height (600x-)', () => {
      expect(parseSizeSpec('600x-')).toEqual({ ...EMPTY, height: 'fit-content', width: '600px' });
    });

    it('should parse fit-content width and fixed height (-x400)', () => {
      expect(parseSizeSpec('-x400')).toEqual({ ...EMPTY, height: '400px', width: 'fit-content' });
    });

    it('should parse both dimensions as fit-content (-x-)', () => {
      expect(parseSizeSpec('-x-')).toEqual({ ...EMPTY, height: 'fit-content', width: 'fit-content' });
    });

    it('should parse height-only (xH) leaving width unset', () => {
      expect(parseSizeSpec('x2800')).toEqual({ ...EMPTY, height: '2800px' });
    });

    it('should parse width-only with trailing separator (Wx)', () => {
      expect(parseSizeSpec('600x')).toEqual({ ...EMPTY, width: '600px' });
    });
  });

  describe('declaration form', () => {
    it('should parse a single property', () => {
      expect(parseSizeSpec('height: max-content')).toEqual({ ...EMPTY, height: 'max-content' });
    });

    it('should parse all six properties', () => {
      expect(parseSizeSpec('width: 600px; height: max-content; min-width: 100px; max-width: 50%; min-height: 10px; max-height: 800px')).toEqual({
        height: 'max-content',
        maxHeight: '800px',
        maxWidth: '50%',
        minHeight: '10px',
        minWidth: '100px',
        width: '600px'
      });
    });

    it('should be case-insensitive for property names', () => {
      expect(parseSizeSpec('MIN-WIDTH: 100px')).toEqual({ ...EMPTY, minWidth: '100px' });
    });

    it('should ignore unknown properties', () => {
      expect(parseSizeSpec('color: red; height: 400px')).toEqual({ ...EMPTY, height: '400px' });
    });

    it('should append px to a bare pure number value', () => {
      expect(parseSizeSpec('width: 600')).toEqual({ ...EMPTY, width: '600px' });
    });

    it('should expand a dash value to fit-content', () => {
      expect(parseSizeSpec('height: -')).toEqual({ ...EMPTY, height: 'fit-content' });
    });

    it('should ignore a declaration with no colon among valid ones', () => {
      expect(parseSizeSpec('height: 400px; garbage')).toEqual({ ...EMPTY, height: '400px' });
    });

    it('should tolerate trailing semicolons and extra whitespace', () => {
      expect(parseSizeSpec('  height:400px ;  ')).toEqual({ ...EMPTY, height: '400px' });
    });

    it('should keep the last value when a property is repeated', () => {
      expect(parseSizeSpec('height: 400px; height: 800px')).toEqual({ ...EMPTY, height: '800px' });
    });
  });
});

describe('getContentKeyword', () => {
  it('should return null for null', () => {
    expect(getContentKeyword(null)).toBeNull();
  });

  it('should return null for a literal length', () => {
    expect(getContentKeyword('400px')).toBeNull();
  });

  it('should return null for auto', () => {
    expect(getContentKeyword('auto')).toBeNull();
  });

  it('should recognize max-content', () => {
    expect(getContentKeyword('max-content')).toBe('max-content');
  });

  it('should recognize min-content', () => {
    expect(getContentKeyword('min-content')).toBe('min-content');
  });

  it('should recognize fit-content', () => {
    expect(getContentKeyword('fit-content')).toBe('fit-content');
  });

  it('should be case-insensitive and trim', () => {
    expect(getContentKeyword('  MAX-CONTENT ')).toBe('max-content');
  });
});
