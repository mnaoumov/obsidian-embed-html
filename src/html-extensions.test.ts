import {
  describe,
  expect,
  it
} from 'vitest';

import { HtmlExtensions } from './html-extensions.ts';

describe('HtmlExtensions', () => {
  it('should return all supported HTML file extensions', () => {
    const htmlExtensions = new HtmlExtensions();
    const extensions = htmlExtensions.list();

    expect(extensions).toEqual(['htm', 'html', 'shtml', 'xht', 'xhtml']);
  });

  it('should return a new array on each call', () => {
    const htmlExtensions = new HtmlExtensions();
    const first = htmlExtensions.list();
    const second = htmlExtensions.list();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
