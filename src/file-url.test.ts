import {
  describe,
  expect,
  it
} from 'vitest';

import { buildFileUrl } from './file-url.ts';

describe('buildFileUrl', () => {
  it('should build a Windows drive path into a rooted file URL', () => {
    expect(buildFileUrl(String.raw`C:\Vault\Doc.html`)).toBe('file:///C:/Vault/Doc.html');
  });

  it('should build a POSIX path without doubling its root slash', () => {
    expect(buildFileUrl('/home/user/vault/Doc.html')).toBe('file:///home/user/vault/Doc.html');
  });

  it('should escape spaces in the path while leaving separators and the drive colon intact', () => {
    expect(buildFileUrl(String.raw`C:\My Vault\Some Doc.html`)).toBe('file:///C:/My%20Vault/Some%20Doc.html');
  });

  it('should escape a hash in the FILE NAME so it is not read as a fragment', () => {
    // Without this the URL would break at `Draft`, and the browser would open the wrong document.
    expect(buildFileUrl('/vault/Draft#2.html')).toBe('file:///vault/Draft%232.html');
  });

  it('should percent-encode a non-ASCII path as UTF-8', () => {
    expect(buildFileUrl('/vault/文書.html')).toBe('file:///vault/%E6%96%87%E6%9B%B8.html');
  });
});
