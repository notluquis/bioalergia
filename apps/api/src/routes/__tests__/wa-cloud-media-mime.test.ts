import { describe, expect, it } from "vitest";

// Mirror the proxy MIME-override logic so we can unit-test it.
function pickContentType(
  upstreamCT: string,
  filename: string,
  storedMime: string | null,
): string {
  let contentType = upstreamCT || storedMime || "application/octet-stream";
  const lowerName = filename.toLowerCase();
  if (contentType === "application/octet-stream" || contentType === "binary/octet-stream") {
    if (lowerName.endsWith(".pdf")) contentType = "application/pdf";
    else if (lowerName.endsWith(".png")) contentType = "image/png";
    else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) contentType = "image/jpeg";
    else if (lowerName.endsWith(".webp")) contentType = "image/webp";
    else if (lowerName.endsWith(".mp4")) contentType = "video/mp4";
    else if (lowerName.endsWith(".webm")) contentType = "video/webm";
    else if (lowerName.endsWith(".ogg")) contentType = "audio/ogg";
    else if (lowerName.endsWith(".mp3")) contentType = "audio/mpeg";
  }
  return contentType;
}

describe("media proxy Content-Type override", () => {
  it("respects upstream Content-Type when concrete", () => {
    expect(pickContentType("image/png", "x.pdf", null)).toBe("image/png");
  });

  it("upgrades octet-stream + .pdf → application/pdf", () => {
    expect(pickContentType("application/octet-stream", "report.pdf", null)).toBe(
      "application/pdf",
    );
  });

  it("upgrades binary/octet-stream + .jpeg → image/jpeg", () => {
    expect(pickContentType("binary/octet-stream", "photo.JPEG", null)).toBe("image/jpeg");
  });

  it("upgrades octet-stream + .webp → image/webp", () => {
    expect(pickContentType("application/octet-stream", "img.webp", null)).toBe("image/webp");
  });

  it("upgrades octet-stream + .mp4 → video/mp4", () => {
    expect(pickContentType("application/octet-stream", "clip.mp4", null)).toBe("video/mp4");
  });

  it("upgrades octet-stream + .ogg → audio/ogg", () => {
    expect(pickContentType("application/octet-stream", "voice.ogg", null)).toBe("audio/ogg");
  });

  it("falls back to stored mime when upstream empty", () => {
    expect(pickContentType("", "x.bin", "image/png")).toBe("image/png");
  });

  it("returns octet-stream when no info anywhere", () => {
    expect(pickContentType("", "x.bin", null)).toBe("application/octet-stream");
  });

  it("does not override when upstream is image/jpeg even with .pdf filename", () => {
    expect(pickContentType("image/jpeg", "weird.pdf", null)).toBe("image/jpeg");
  });
});
