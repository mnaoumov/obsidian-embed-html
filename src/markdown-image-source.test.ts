import {
  describe,
  expect,
  it
} from 'vitest';

import { getMarkdownImageSourceLength } from './markdown-image-source.ts';

describe('getMarkdownImageSourceLength', () => {
  it('should measure an image with no alt', () => {
    expect(getMarkdownImageSourceLength('![](https://host/page.html) trailing')).toBe('![](https://host/page.html)'.length);
  });

  it('should measure an image with an alt and a size', () => {
    const image = '![Wide|50%x250](https://host/page.html#id)';
    expect(getMarkdownImageSourceLength(`${image}!`)).toBe(image.length);
  });

  it('should let brackets and parentheses nest, and a backslash escape', () => {
    const image = String.raw`![a [b] \] c](https://host/a_(b).html "t \) x")`;
    expect(getMarkdownImageSourceLength(image)).toBe(image.length);
  });

  it('should reject a text that does not open with an image', () => {
    expect(getMarkdownImageSourceLength('[](https://host/page.html)')).toBeNull();
    expect(getMarkdownImageSourceLength('![alt] (https://host/page.html)')).toBeNull();
  });

  it('should reject an image left open', () => {
    expect(getMarkdownImageSourceLength('![alt')).toBeNull();
    expect(getMarkdownImageSourceLength('![alt](https://host/page.html')).toBeNull();
    expect(getMarkdownImageSourceLength('![alt](https://host/\npage.html)')).toBeNull();
  });
});
