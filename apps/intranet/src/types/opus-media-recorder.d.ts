// opus-media-recorder ships no types. It's a MediaRecorder polyfill that
// encodes Opus into a real Ogg/WebM container via WebAssembly, so the browser
// can produce `audio/ogg;codecs=opus` (which Chrome's native MediaRecorder
// can't) — the only WhatsApp Cloud-compatible voice-note container we can make
// cross-browser. We use it to record voice notes the WA API will accept.
declare module "opus-media-recorder" {
  // Paths to the encoder worker + WASM binaries, resolved by Vite's `?url`.
  interface OpusWorkerOptions {
    encoderWorkerFactory: () => Worker;
    OggOpusEncoderWasmPath: string;
    WebMOpusEncoderWasmPath: string;
  }

  // Subset of the MediaRecorder surface we actually use.
  export default class OpusMediaRecorder {
    constructor(
      stream: MediaStream,
      options?: { mimeType?: string },
      workerOptions?: OpusWorkerOptions
    );
    readonly state: "inactive" | "recording" | "paused";
    readonly mimeType: string;
    ondataavailable: ((event: { data: Blob }) => void) | null;
    onstop: (() => void) | null;
    onerror: ((event: { error?: unknown }) => void) | null;
    start(timeslice?: number): void;
    stop(): void;
  }
}
