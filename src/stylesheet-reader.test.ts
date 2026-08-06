import { requestUrl } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { readStylesheetTextAsync } from './stylesheet-reader.ts';

// A thin return-value stub of `requestUrl`, so the reader's transport choice is observable. The real
// Obsidian request API cannot run in a unit test, and the test-mocks implementation always answers with an
// Empty body, which would not distinguish "read the remote stylesheet" from "read nothing".
vi.mock('obsidian', async (importOriginal) => ({
  ...await importOriginal<typeof import('obsidian')>(),
  requestUrl: vi.fn()
}));

const CSS = 'h1 { color: red; }';
const LOCAL_URL = 'app://vault-hash/C:/Vault/styles/main.css';
const REMOTE_URL = 'https://cdn.example.com/main.css';
const NOT_FOUND_STATUS = 404;

function mockFetch(response: Partial<Response>): void {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)));
}

describe('readStylesheetTextAsync', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(requestUrl).mockReset();
  });

  it('should read a remote stylesheet through Obsidian, which is not CORS-bound', async () => {
    // `requestUrl` answers with a promise that ALSO exposes the response fields, so the stub mirrors both.
    vi.mocked(requestUrl).mockReturnValue(castTo<ReturnType<typeof requestUrl>>(Object.assign(Promise.resolve({ text: CSS }), { text: CSS })));
    mockFetch({ ok: true, text: () => Promise.resolve('WRONG TRANSPORT') });

    const css = await readStylesheetTextAsync(REMOTE_URL);

    expect(css).toBe(CSS);
    expect(requestUrl).toHaveBeenCalledWith({ url: REMOTE_URL });
    expect(activeWindow.fetch).not.toHaveBeenCalled();
  });

  it('should read a vault stylesheet with a plain fetch', async () => {
    mockFetch({ ok: true, text: () => Promise.resolve(CSS) });

    const css = await readStylesheetTextAsync(LOCAL_URL);

    expect(css).toBe(CSS);
    expect(activeWindow.fetch).toHaveBeenCalledWith(LOCAL_URL);
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it('should return null when the stylesheet is missing', async () => {
    mockFetch({ ok: false, status: NOT_FOUND_STATUS });

    expect(await readStylesheetTextAsync(LOCAL_URL)).toBeNull();
  });

  it('should return null when the read throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    expect(await readStylesheetTextAsync(LOCAL_URL)).toBeNull();
  });
});
