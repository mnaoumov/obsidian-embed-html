import {
  describe,
  expect,
  it
} from 'vitest';

import { buildFileUrl } from './file-url.ts';

describe('buildFileUrl', () => {
  it('should build a Windows drive path into a rooted file URL', () => {
    expect(buildFileUrl(String.raw`C:\Vault\Doc.html`, '')).toBe('file:///C:/Vault/Doc.html');
  });

  it('should build a POSIX path without doubling its root slash', () => {
    expect(buildFileUrl('/home/user/vault/Doc.html', '')).toBe('file:///home/user/vault/Doc.html');
  });

  it('should append the fragment, which is the whole point of the mode (issue #14)', () => {
    expect(buildFileUrl(String.raw`C:\Vault\Doc.html`, '#section-3')).toBe('file:///C:/Vault/Doc.html#section-3');
  });

  it('should accept a fragment given without its leading hash', () => {
    expect(buildFileUrl('/vault/Doc.html', 'section-3')).toBe('file:///vault/Doc.html#section-3');
  });

  it('should treat an empty or bare-hash subpath as no fragment', () => {
    expect(buildFileUrl('/vault/Doc.html', ' '.repeat(3))).toBe('file:///vault/Doc.html');
    expect(buildFileUrl('/vault/Doc.html', '#')).toBe('file:///vault/Doc.html');
  });

  it('should escape spaces in the path while leaving separators and the drive colon intact', () => {
    expect(buildFileUrl(String.raw`C:\My Vault\Some Doc.html`, '')).toBe('file:///C:/My%20Vault/Some%20Doc.html');
  });

  it('should escape a hash in the FILE NAME so it is not read as the fragment', () => {
    // Without this the URL would break at `Draft`, and the browser would open the wrong document.
    expect(buildFileUrl('/vault/Draft#2.html', '#top')).toBe('file:///vault/Draft%232.html#top');
  });

  it('should escape a space in the fragment', () => {
    expect(buildFileUrl('/vault/Doc.html', '#My Section')).toBe('file:///vault/Doc.html#My%20Section');
  });

  it('should treat a percent sign in the fragment as literal text', () => {
    // Obsidian hands the subpath over decoded (`#My Section`, not `#My%20Section`), so a `%` in it is a
    // Literal percent sign and is escaped as one. An already-encoded fragment is therefore encoded
    // Again — deliberate: which of the two the caller meant is not decidable.
    expect(buildFileUrl('/vault/Doc.html', '#100%25')).toBe('file:///vault/Doc.html#100%2525');
  });

  it('should percent-encode a non-ASCII path and fragment as UTF-8', () => {
    expect(buildFileUrl('/vault/文書.html', '#節')).toBe('file:///vault/%E6%96%87%E6%9B%B8.html#%E7%AF%80');
  });
});
