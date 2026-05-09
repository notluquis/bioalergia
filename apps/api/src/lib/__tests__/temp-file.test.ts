import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { sanitizeUploadFilename, writeTempUpload } from "../temp-file.ts";

describe("sanitizeUploadFilename", () => {
  it("strips directory components", () => {
    expect(sanitizeUploadFilename("/etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeUploadFilename("a/../../b.pdf")).toBe("b.pdf");
  });

  it("collapses traversal attempts that survive basename", () => {
    // path.basename("x/../../../etc/passwd") is "passwd"; no traversal remains.
    expect(sanitizeUploadFilename("x/../../../etc/passwd")).toBe("passwd");
    // A bare "../" has basename ""; sanitizer returns "".
    expect(sanitizeUploadFilename("../")).toBe("");
  });

  it("rejects leading dots so the name cannot become a dotfile or '..'", () => {
    expect(sanitizeUploadFilename("..")).toBe("");
    expect(sanitizeUploadFilename("...hidden")).toBe("hidden");
    expect(sanitizeUploadFilename(".bashrc")).toBe("bashrc");
  });

  it("replaces shell metacharacters and whitespace with underscores", () => {
    expect(sanitizeUploadFilename("report $(whoami).pdf")).toBe("report_whoami_.pdf");
    expect(sanitizeUploadFilename("a b;c&d|e.txt")).toBe("a_b_c_d_e.txt");
  });

  it("keeps alphanumerics, dots, hyphens and underscores", () => {
    expect(sanitizeUploadFilename("Exam-Result_2026.04.18.pdf")).toBe(
      "Exam-Result_2026.04.18.pdf",
    );
  });

  it("caps length", () => {
    const long = "a".repeat(500) + ".pdf";
    expect(sanitizeUploadFilename(long).length).toBe(200);
  });

  it("returns empty string for falsy input", () => {
    expect(sanitizeUploadFilename(undefined)).toBe("");
    expect(sanitizeUploadFilename("")).toBe("");
  });
});

describe("writeTempUpload", () => {
  it("writes data inside an isolated temp directory and cleans up", async () => {
    const payload = Buffer.from("hello world");
    const { filepath, cleanup } = await writeTempUpload(payload, "Report-A.pdf");

    try {
      expect(path.basename(filepath)).toBe("Report-A.pdf");
      expect(path.dirname(filepath)).toMatch(/bioalergia-upload-/);
      expect(await readFile(filepath)).toEqual(payload);
    } finally {
      await cleanup();
    }

    await expect(stat(filepath)).rejects.toThrow(/ENOENT/);
  });

  it("neutralizes path traversal in the preferred name", async () => {
    const payload = Buffer.from("payload");
    const { filepath, cleanup } = await writeTempUpload(
      payload,
      "x/../../../etc/passwd",
    );

    try {
      expect(path.basename(filepath)).toBe("passwd");
      // filepath must stay within the mkdtemp-created directory.
      expect(path.dirname(filepath)).toMatch(/bioalergia-upload-/);
    } finally {
      await cleanup();
    }
  });

  it("falls back to a random filename when the hint is unusable", async () => {
    const payload = Buffer.from("payload");
    const { filepath, cleanup } = await writeTempUpload(payload, "..");

    try {
      expect(path.basename(filepath)).toMatch(/\.bin$/);
    } finally {
      await cleanup();
    }
  });
});
