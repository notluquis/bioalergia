/**
 * Tests for `syntheticWaveform` — the deterministic placeholder waveform used
 * by voice notes before (or instead of) real Web Audio decoding.
 *
 * Coverage targets: determinism per seed, custom bucket length, and the
 * documented value range [0.15, 1] every bar is clamped into.
 *
 * Skipping `decodeWaveform` itself — it needs a real `AudioContext` +
 * `decodeAudioData`, which jsdom does not provide. Its render path is covered
 * by the inbox stories / manual verification.
 */

import { describe, expect, it } from "vitest";
import { syntheticWaveform } from "./decodeWaveform";

describe("syntheticWaveform", () => {
  it("is deterministic for a given seed (two calls equal)", () => {
    const a = syntheticWaveform(12345);
    const b = syntheticWaveform(12345);
    expect(a).toEqual(b);
  });

  it("produces different shapes for different seeds", () => {
    const a = syntheticWaveform(1);
    const b = syntheticWaveform(2);
    expect(a).not.toEqual(b);
  });

  it("defaults to 32 buckets", () => {
    expect(syntheticWaveform(7)).toHaveLength(32);
  });

  it("honours a custom bucket count", () => {
    expect(syntheticWaveform(7, 8)).toHaveLength(8);
    expect(syntheticWaveform(7, 64)).toHaveLength(64);
  });

  it("clamps every bar into [0.15, 1]", () => {
    for (const value of syntheticWaveform(98765, 64)) {
      expect(value).toBeGreaterThanOrEqual(0.15);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("treats a falsy seed as 1 (deterministic, in range)", () => {
    const fromZero = syntheticWaveform(0);
    expect(fromZero).toEqual(syntheticWaveform(1));
    expect(fromZero).toHaveLength(32);
  });
});
