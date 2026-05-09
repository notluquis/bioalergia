import { describe, expect, it } from "vitest";

import {
  MINIMAL_CONFIG,
  MODERATE_CONFIG,
  RICH_CONFIG,
  SANITIZE_CONFIG,
  sanitizeHtml,
} from "../html-sanitizer.ts";

// NOTE: sanitizeHtmlWithOptions and htmlSanitizerMiddleware are excluded because they
// depend on rate-limiting infrastructure (getGlobalMonitor) and Hono middleware context.
// clearWindowState is also excluded because it only clears jsdom state — no testable output.

describe("html-sanitizer", () => {
  // ──────────────────────────────────────────────────────────────────────────
  describe("config presets", () => {
    it("MINIMAL_CONFIG allows only basic formatting tags", () => {
      const expected = ["b", "i", "em", "strong", "u", "p", "br"];
      for (const tag of expected) {
        expect(MINIMAL_CONFIG.ALLOWED_TAGS).toContain(tag);
      }
    });

    it("MINIMAL_CONFIG disallows all attributes", () => {
      expect(MINIMAL_CONFIG.ALLOWED_ATTR).toHaveLength(0);
    });

    it("MODERATE_CONFIG allows links and divs in addition to basic formatting", () => {
      expect(MODERATE_CONFIG.ALLOWED_TAGS).toContain("a");
      expect(MODERATE_CONFIG.ALLOWED_TAGS).toContain("div");
    });

    it("MODERATE_CONFIG allows href and title attributes", () => {
      expect(MODERATE_CONFIG.ALLOWED_ATTR).toContain("href");
      expect(MODERATE_CONFIG.ALLOWED_ATTR).toContain("title");
    });

    it("RICH_CONFIG includes table-related tags", () => {
      const tableTags = ["table", "thead", "tbody", "tr", "td", "th"];
      for (const tag of tableTags) {
        expect(RICH_CONFIG.ALLOWED_TAGS).toContain(tag);
      }
    });

    it("RICH_CONFIG includes heading tags", () => {
      for (let i = 1; i <= 6; i++) {
        expect(RICH_CONFIG.ALLOWED_TAGS).toContain(`h${i}`);
      }
    });

    it("RICH_CONFIG includes img tag", () => {
      expect(RICH_CONFIG.ALLOWED_TAGS).toContain("img");
    });

    it("RICH_CONFIG allows style attribute", () => {
      expect(RICH_CONFIG.ALLOWED_ATTR).toContain("style");
    });

    it("SANITIZE_CONFIG is an alias for RICH_CONFIG", () => {
      expect(SANITIZE_CONFIG).toBe(RICH_CONFIG);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("sanitizeHtml – rich config (default)", () => {
    it("strips script tags", () => {
      const result = sanitizeHtml('<script>alert("xss")</script><p>Safe</p>');
      expect(result).not.toContain("<script");
      expect(result).toContain("Safe");
    });

    it("strips inline event handlers", () => {
      const result = sanitizeHtml('<p onclick="alert(1)">Hello</p>');
      expect(result).not.toContain("onclick");
      expect(result).toContain("Hello");
    });

    it("strips onerror attribute from img", () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
      expect(result).not.toContain("onerror");
    });

    it("strips javascript: href protocol", () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">Click</a>');
      expect(result).not.toContain("javascript:");
    });

    it("preserves allowed structural tags", () => {
      const result = sanitizeHtml("<div><p>Hello <strong>world</strong></p></div>");
      expect(result).toContain("<div>");
      expect(result).toContain("<p>");
      expect(result).toContain("<strong>");
    });

    it("preserves clean anchor tags", () => {
      const result = sanitizeHtml('<a href="https://example.com">Link</a>');
      expect(result).toContain("<a");
      expect(result).toContain("href");
      expect(result).toContain("Link");
    });

    it("preserves heading tags", () => {
      const result = sanitizeHtml("<h1>Title</h1><h2>Subtitle</h2>");
      expect(result).toContain("<h1>");
      expect(result).toContain("<h2>");
    });

    it("preserves table structure", () => {
      const result = sanitizeHtml(
        "<table><thead><tr><th>Col</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>",
      );
      expect(result).toContain("<table>");
      expect(result).toContain("<td>");
    });

    it("strips form elements (input, form)", () => {
      const result = sanitizeHtml('<form action="/steal"><input type="text" name="user"></form>');
      expect(result).not.toContain("<form");
      expect(result).not.toContain("<input");
    });

    it("returns empty string for empty input", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("passes through plain text", () => {
      const result = sanitizeHtml("Hello, world!");
      expect(result).toContain("Hello, world!");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("sanitizeHtml – minimal config", () => {
    it("strips img tags", () => {
      const result = sanitizeHtml('<p>Comment <img src="x"></p>', "minimal");
      expect(result).not.toContain("<img");
    });

    it("strips anchor tags", () => {
      const result = sanitizeHtml('<a href="https://example.com">Link</a>', "minimal");
      expect(result).not.toContain("<a");
    });

    it("strips div tags but keeps content (KEEP_CONTENT)", () => {
      const result = sanitizeHtml("<div>Inner text</div>", "minimal");
      expect(result).not.toContain("<div");
      expect(result).toContain("Inner text");
    });

    it("preserves basic formatting tags", () => {
      const result = sanitizeHtml("<p><strong>Bold</strong> and <em>italic</em></p>", "minimal");
      expect(result).toContain("<strong>");
      expect(result).toContain("<em>");
      expect(result).toContain("<p>");
    });

    it("strips all attributes from allowed tags", () => {
      const result = sanitizeHtml('<p class="foo" id="bar">Text</p>', "minimal");
      expect(result).not.toContain("class");
      expect(result).not.toContain("id");
      expect(result).toContain("Text");
    });

    it("strips script tags", () => {
      const result = sanitizeHtml("<script>evil()</script><b>Safe</b>", "minimal");
      expect(result).not.toContain("<script");
      expect(result).toContain("Safe");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("sanitizeHtml – moderate config", () => {
    it("preserves anchor tags with href", () => {
      const result = sanitizeHtml('<a href="https://example.com">Link</a>', "moderate");
      expect(result).toContain("<a");
      expect(result).toContain("href");
    });

    it("strips img tags", () => {
      const result = sanitizeHtml('<img src="photo.jpg" alt="photo">', "moderate");
      expect(result).not.toContain("<img");
    });

    it("strips table tags", () => {
      const result = sanitizeHtml("<table><tr><td>Data</td></tr></table>", "moderate");
      expect(result).not.toContain("<table");
    });

    it("strips script tags", () => {
      const result = sanitizeHtml('<script>alert("xss")</script>', "moderate");
      expect(result).not.toContain("<script");
    });

    it("preserves text formatting and divs", () => {
      const result = sanitizeHtml("<div><b>Bold</b> <i>Italic</i></div>", "moderate");
      expect(result).toContain("<div>");
      expect(result).toContain("<b>");
      expect(result).toContain("<i>");
    });

    it("strips non-allowed attributes from anchor tags", () => {
      const result = sanitizeHtml('<a href="https://example.com" onclick="evil()">Link</a>', "moderate");
      expect(result).not.toContain("onclick");
      expect(result).toContain("href");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("sanitizeHtml – XSS attack vectors", () => {
    it("handles SVG-based XSS", () => {
      const result = sanitizeHtml(
        '<svg><script>alert(1)</script></svg>',
        "rich",
      );
      expect(result).not.toContain("<script");
    });

    it("handles data URI injection attempt", () => {
      const result = sanitizeHtml(
        '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
        "moderate",
      );
      expect(result).not.toContain("data:text/html");
    });

    it("handles HTML entity encoded XSS attempt", () => {
      const result = sanitizeHtml("<p>Safe &lt;script&gt;alert(1)&lt;/script&gt;</p>");
      // Encoded entities are text nodes, not actual tags — should pass through safely
      expect(result).toContain("Safe");
      expect(result).not.toContain("<script>");
    });

    it("handles nested dangerous tag stripping", () => {
      const result = sanitizeHtml(
        '<div><p><span onmouseover="steal()">Hover</span></p></div>',
      );
      expect(result).not.toContain("onmouseover");
      expect(result).toContain("Hover");
    });

    it("handles iframe injection", () => {
      const result = sanitizeHtml('<iframe src="https://evil.com"></iframe>', "rich");
      expect(result).not.toContain("<iframe");
    });

    it("handles meta refresh injection", () => {
      const result = sanitizeHtml(
        '<meta http-equiv="refresh" content="0;url=https://evil.com">',
        "rich",
      );
      expect(result).not.toContain("<meta");
    });
  });
});
