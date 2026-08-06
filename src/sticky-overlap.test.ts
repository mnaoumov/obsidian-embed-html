import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { measureStickyOverlap } from './sticky-overlap.ts';

const HEADER_HEIGHT = 40;
const TARGET_HEIGHT = 30;
const PROBE_WIDTH = 200;

interface RectSpec {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

interface Scenario {
  headerEl: HTMLElement;
  targetEl: HTMLElement;
}

/**
 * Builds a sticky header and a target in the live document, with the hit test answering with the given
 * elements.
 *
 * @param headerPosition - The computed `position` the header reports.
 * @param buildHitTestResult - What the hit test at the probe point returns, topmost first.
 * @returns The header and target elements.
 */
function buildScenario(headerPosition: string, buildHitTestResult?: (scenario: Scenario) => Element[]): Scenario {
  const headerEl = createDiv();
  const targetEl = createDiv();
  document.body.append(headerEl, targetEl);

  stubRect(headerEl, rectAt(0, HEADER_HEIGHT));
  stubRect(targetEl, rectAt(0, TARGET_HEIGHT));

  vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => ({ position: el === headerEl ? headerPosition : 'static' }) as CSSStyleDeclaration);

  const scenario: Scenario = { headerEl, targetEl };
  stubHitTest(buildHitTestResult ? buildHitTestResult(scenario) : [headerEl, document.body]);

  return scenario;
}

/**
 * Builds a rect from a top edge and a height, spanning the full probe width.
 *
 * @param top - The top edge.
 * @param height - The height.
 * @returns The rect.
 */
function rectAt(top: number, height: number): RectSpec {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: PROBE_WIDTH,
    top,
    width: PROBE_WIDTH
  };
}

/**
 * Makes the document's hit test return a fixed list.
 *
 * @param elements - The elements to return, topmost first.
 */
function stubHitTest(elements: Element[]): void {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: (): Element[] => elements
  });
}

/**
 * Jsdom has no layout and no hit testing, so both are stubbed. What is under test is which of the
 * elements at the probe point count as covering the target and by how much — not how a browser lays them
 * out.
 *
 * @param el - The element to give a rect to.
 * @param rect - The rect it should report.
 */
function stubRect(el: Element, rect: RectSpec): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect,
    toJSON: () => rect,
    x: rect.left,
    y: rect.top
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'elementsFromPoint');
  document.body.empty();
});

describe('measureStickyOverlap', () => {
  it('should report how far a sticky header covers the target', () => {
    const { targetEl } = buildScenario('sticky');
    expect(measureStickyOverlap(document, targetEl)).toBe(HEADER_HEIGHT);
  });

  it('should report the same for a fixed header', () => {
    const { targetEl } = buildScenario('fixed');
    expect(measureStickyOverlap(document, targetEl)).toBe(HEADER_HEIGHT);
  });

  it('should report no overlap for a statically positioned element at the same place', () => {
    const { targetEl } = buildScenario('static');
    expect(measureStickyOverlap(document, targetEl)).toBe(0);
  });

  it('should not count the target itself, nor an ancestor of it', () => {
    const { targetEl } = buildScenario('sticky', ({ targetEl: target }) => [target, document.body]);
    expect(measureStickyOverlap(document, targetEl)).toBe(0);
  });

  it('should report no overlap when nothing is at the probe point', () => {
    const { targetEl } = buildScenario('sticky', () => []);
    expect(measureStickyOverlap(document, targetEl)).toBe(0);
  });

  it('should report no overlap for a detached document, which has no window to compute styles against', () => {
    // The target is never touched: with no window there is nothing to compute styles against, so the
    // Measurement gives up before it reads the element at all.
    const detachedDoc = document.implementation.createHTMLDocument('detached');
    expect(measureStickyOverlap(detachedDoc, createDiv())).toBe(0);
  });

  it('should report no overlap in a runtime with no hit testing', () => {
    const targetEl = createDiv();
    document.body.append(targetEl);
    // Jsdom does not implement `elementsFromPoint`, so this is the real shape rather than a contrived one.
    expect(measureStickyOverlap(document, targetEl)).toBe(0);
  });
});
