import { expect } from "vitest";

/**
 * Asserts an element's text flows horizontally (writing-mode: horizontal-tb)
 * and has at least 4ch of width — catches the "one letter per line" collapse
 * regression where a flex child without min-width:0 squeezes a textarea/input
 * down to ~12px and the browser stacks glyphs vertically.
 */
export function expectHorizontalTextFlow(el: HTMLElement) {
  const cs = getComputedStyle(el);
  expect(cs.writingMode, "writing-mode must be horizontal-tb").toBe("horizontal-tb");
  const width = parseFloat(cs.width);
  const fontSize = parseFloat(cs.fontSize);
  expect(
    width,
    `${el.tagName} width ${width}px is below 4ch minimum (${fontSize * 4}px)`
  ).toBeGreaterThan(fontSize * 4);
}

/**
 * Asserts an element does not visually clip its own text content. Catches the
 * breadcrumb / title truncation regression where parent overflow:hidden +
 * no text-overflow:ellipsis silently cuts content.
 *
 * Either the element fits, or it must declare a visible truncation indicator
 * (text-overflow:ellipsis, an ellipsis character in the rendered text, or
 * a `data-truncated` attribute the component sets when it clips on purpose).
 */
export function expectNoSilentClipping(el: HTMLElement) {
  const isClipped = el.scrollWidth > el.clientWidth;
  if (!isClipped) return;
  const cs = getComputedStyle(el);
  const hasEllipsis = cs.textOverflow === "ellipsis";
  const declaredTruncation = el.dataset.truncated === "true";
  const visibleEllipsis =
    el.textContent?.includes("…") || el.textContent?.includes("...");
  expect(
    hasEllipsis || declaredTruncation || visibleEllipsis,
    `${el.tagName} clips content (scrollWidth ${el.scrollWidth} > clientWidth ${el.clientWidth}) without text-overflow:ellipsis or visible indicator`
  ).toBe(true);
}
