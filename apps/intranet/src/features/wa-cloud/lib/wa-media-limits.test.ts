/**
 * Tests for `wa-media-limits` — client-side classification of files
 * against Meta WhatsApp Cloud API v22+ media limits.
 *
 * Coverage targets: every branch of `classifyFile` (sticker/image/audio/
 * video/document, HEIC rejection, oversize rejection, ext-only fallback
 * for Safari empty-mime case) plus `buildSharedCaption` truncation +
 * `isHeic` boundary.
 *
 * Skipping `tryConvertHeicToJpeg` — depends on browser HEIC decoder
 * (Safari-only). jsdom does not decode HEIC; e2e coverage lives in the
 * real-browser share-target spec.
 */

import { describe, expect, it } from "vitest";
import { buildSharedCaption, classifyFile, isHeic } from "./wa-media-limits";

const KB = 1024;
const MB = 1024 * KB;

function fakeFile(name: string, type: string, size: number) {
  return { name, type, size };
}

describe("classifyFile", () => {
  it("classifies a regular JPEG image as type=image", () => {
    const r = classifyFile(fakeFile("photo.jpg", "image/jpeg", 1 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe("image");
      expect(r.mime).toBe("image/jpeg");
    }
  });

  it("classifies a WEBP as sticker (sticker rule wins over image)", () => {
    const r = classifyFile(fakeFile("sticker.webp", "image/webp", 100 * KB));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("sticker");
  });

  it("classifies a PDF as document", () => {
    const r = classifyFile(fakeFile("doc.pdf", "application/pdf", 2 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("document");
  });

  it("classifies an MP4 as video", () => {
    const r = classifyFile(fakeFile("clip.mp4", "video/mp4", 5 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("video");
  });

  it("classifies an MP3 as audio", () => {
    const r = classifyFile(fakeFile("song.mp3", "audio/mpeg", 1 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.type).toBe("audio");
  });

  it("rejects HEIC by mime", () => {
    const r = classifyFile(fakeFile("img.heic", "image/heic", 100 * KB));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/HEIC/);
  });

  it("rejects HEIC by extension when mime is empty (Safari share intent)", () => {
    const r = classifyFile(fakeFile("img.HEIC", "", 100 * KB));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/HEIC/);
  });

  it("rejects oversize image (>5MB cap)", () => {
    const r = classifyFile(fakeFile("huge.jpg", "image/jpeg", 6 * MB));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/excede el máximo/);
  });

  it("rejects oversize PDF (>100MB cap)", () => {
    const r = classifyFile(fakeFile("huge.pdf", "application/pdf", 200 * MB));
    expect(r.ok).toBe(false);
  });

  it("recovers mime from extension when file.type is empty", () => {
    const r = classifyFile(fakeFile("photo.jpg", "", 1 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.type).toBe("image");
      expect(r.mime).toBe("image/jpeg");
    }
  });

  it("normalizes .3gp extension to video/3gpp mime", () => {
    const r = classifyFile(fakeFile("v.3gp", "", 1 * MB));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mime).toBe("video/3gpp");
  });

  it("rejects unknown formats", () => {
    const r = classifyFile(fakeFile("weird.xyz", "application/x-weird", 100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/no soportado/);
  });

  it("rejects unknown mime + unknown extension", () => {
    const r = classifyFile(fakeFile("noext", "", 100));
    expect(r.ok).toBe(false);
  });
});

describe("isHeic", () => {
  it("returns true for HEIC mime", () => {
    expect(isHeic({ name: "x.foo", type: "image/heic" })).toBe(true);
  });
  it("returns true for HEIF extension", () => {
    expect(isHeic({ name: "x.heif", type: "" })).toBe(true);
  });
  it("returns false for JPEG", () => {
    expect(isHeic({ name: "x.jpg", type: "image/jpeg" })).toBe(false);
  });
});

describe("buildSharedCaption", () => {
  it("joins title + text + url with newlines", () => {
    expect(buildSharedCaption({ title: "T", text: "Hello", url: "https://x" })).toBe(
      "T\nHello\nhttps://x"
    );
  });

  it("filters out empty parts", () => {
    expect(buildSharedCaption({ title: "", text: "Hello", url: "" })).toBe("Hello");
  });

  it("truncates to 1024 chars with ellipsis", () => {
    const long = "x".repeat(2000);
    const out = buildSharedCaption({ title: long, text: "", url: "" });
    expect(out.length).toBe(1024);
    expect(out.endsWith("...")).toBe(true);
  });

  it("does not truncate when total <= 1024", () => {
    const out = buildSharedCaption({ title: "a".repeat(100), text: "", url: "" });
    expect(out.length).toBe(100);
    expect(out.endsWith("...")).toBe(false);
  });
});
