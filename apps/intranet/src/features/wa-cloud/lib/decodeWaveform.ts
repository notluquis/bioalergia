// Voice-note waveform helpers. Zero paid deps, zero network beyond the audio
// file itself. `syntheticWaveform` gives an instant deterministic placeholder
// (so a voice note always *looks* like one); `decodeWaveform` upgrades it to
// real amplitude on first play via the Web Audio API. Decode can fail on some
// opus/webm streams (documented Chrome quirk) — callers fall back to synthetic.

const DEFAULT_BUCKETS = 32;

// Deterministic pseudo-random bars seeded by a stable id (e.g. messageId), so a
// given voice note always renders the same shape across re-renders. Mulberry32.
export function syntheticWaveform(seed: number, buckets = DEFAULT_BUCKETS): number[] {
  let s = (seed || 1) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < buckets; i++) {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // Bias toward mid heights with a centred hump so it reads as speech.
    const hump = Math.sin((i / buckets) * Math.PI);
    out.push(Math.max(0.15, Math.min(1, 0.25 + r * 0.6 + hump * 0.2)));
  }
  return out;
}

// Decode the audio at `url` into `buckets` RMS amplitudes normalised to 0..1.
// Throws on decode failure; the caller should try/catch and fall back.
export async function decodeWaveform(url: string, buckets = DEFAULT_BUCKETS): Promise<number[]> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error("Web Audio API unavailable");
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`waveform fetch ${res.status}`);
  const buf = await res.arrayBuffer();
  const ctx = new AudioCtx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const block = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < buckets; i++) {
      let sum = 0;
      const start = i * block;
      for (let j = 0; j < block; j++) {
        const v = data[start + j] ?? 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / block);
      peaks.push(rms);
      if (rms > max) max = rms;
    }
    return max > 0
      ? peaks.map((p) => Math.max(0.08, p / max))
      : syntheticWaveform(buf.byteLength, buckets);
  } finally {
    void ctx.close();
  }
}
