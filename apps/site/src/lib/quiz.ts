// Pure quiz navigation/progress helpers, extracted from
// routes/eres-alergico.tsx so they are unit-testable without a React renderer.
// Behavior is byte-identical to the original inline expressions.

/**
 * Number of answered questions: counts entries that are not `undefined`.
 * Mirrors `answers.filter((value) => value !== undefined).length`.
 */
export function answeredCount(answers: readonly (number | undefined)[]): number {
  return answers.filter((value) => value !== undefined).length;
}

/**
 * Next question index, clamped to the last index.
 * Mirrors `Math.min(prevCurrent + 1, length - 1)`.
 */
export function nextIndex(current: number, length: number): number {
  return Math.min(current + 1, length - 1);
}

/**
 * Previous question index, clamped to 0.
 * Mirrors `Math.max(prev - 1, 0)`.
 */
export function prevIndex(current: number): number {
  return Math.max(current - 1, 0);
}
