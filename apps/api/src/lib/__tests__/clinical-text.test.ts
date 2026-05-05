import { describe, expect, it } from "vitest";
import {
  joinClinicalText,
  normalizeClinicalText,
  normalizeClinicalTextLower,
} from "../clinical-text";

describe("clinical-text", () => {
  describe("normalizeClinicalText", () => {
    it("returns empty string for null", () => {
      expect(normalizeClinicalText(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(normalizeClinicalText(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(normalizeClinicalText("")).toBe("");
    });

    it("returns plain text as-is (trimmed)", () => {
      expect(normalizeClinicalText("  Hello World  ")).toBe("Hello World");
    });

    it("strips HTML tags and returns text content", () => {
      expect(normalizeClinicalText("<p>Hello</p>")).toBe("Hello");
    });

    it("decodes &amp; entity", () => {
      expect(normalizeClinicalText("cats &amp; dogs")).toBe("cats & dogs");
    });

    it("decodes &lt; and &gt; — but resulting tags are then parsed as HTML and stripped", () => {
      // &lt;test&gt; -> <test> -> parse5 treats it as an unknown tag and strips the tag,
      // leaving only its text content (which is empty for a self-closing unknown tag).
      // The text content inside would be preserved if there was any.
      const result = normalizeClinicalText("prefix &lt;test&gt; suffix");
      expect(result).toBe("prefix suffix");
    });

    it("decodes &quot; entity", () => {
      expect(normalizeClinicalText("&quot;quoted&quot;")).toBe('"quoted"');
    });

    it("decodes &#39; entity", () => {
      expect(normalizeClinicalText("it&#39;s")).toBe("it's");
    });

    it("decodes &nbsp; as space", () => {
      expect(normalizeClinicalText("hello&nbsp;world")).toBe("hello world");
    });

    it("decodes &#160; as space", () => {
      expect(normalizeClinicalText("hello&#160;world")).toBe("hello world");
    });

    it("converts <br> to newline", () => {
      const result = normalizeClinicalText("line1<br>line2");
      expect(result).toBe("line1\nline2");
    });

    it("converts <p> tags to newlines", () => {
      const result = normalizeClinicalText("<p>first</p><p>second</p>");
      expect(result).toContain("first");
      expect(result).toContain("second");
      // Should have a newline separating the two paragraphs
      expect(result).toMatch(/first\n+second/);
    });

    it("handles <div> tags as block elements", () => {
      const result = normalizeClinicalText("<div>block1</div><div>block2</div>");
      expect(result).toContain("block1");
      expect(result).toContain("block2");
    });

    it("collapses multiple consecutive newlines to max two", () => {
      const result = normalizeClinicalText("<p>a</p><p></p><p></p><p>b</p>");
      expect(result).not.toMatch(/\n{3,}/);
    });

    it("collapses multiple spaces to one", () => {
      const result = normalizeClinicalText("hello     world");
      expect(result).toBe("hello world");
    });

    it("handles nested HTML", () => {
      const result = normalizeClinicalText("<div><p>inner <b>bold</b> text</p></div>");
      expect(result).toContain("inner");
      expect(result).toContain("bold");
      expect(result).toContain("text");
    });

    it("handles list items with newlines", () => {
      const result = normalizeClinicalText("<ul><li>item1</li><li>item2</li></ul>");
      expect(result).toContain("item1");
      expect(result).toContain("item2");
    });

    it("trims leading and trailing whitespace from final output", () => {
      const result = normalizeClinicalText("<p>  text  </p>");
      expect(result).not.toMatch(/^\s/);
      expect(result).not.toMatch(/\s$/);
    });

    it("handles table cell tags (td, th, tr) as block elements", () => {
      const result = normalizeClinicalText("<table><tr><td>cell</td></tr></table>");
      expect(result).toContain("cell");
    });

    it("returns only text from complex mixed HTML", () => {
      const html = '<div class="notes"><p>Patient has <strong>allergies</strong> to penicillin.</p></div>';
      const result = normalizeClinicalText(html);
      expect(result).toBe("Patient has allergies to penicillin.");
    });
  });

  describe("joinClinicalText", () => {
    it("joins two plain strings with default separator (space)", () => {
      expect(joinClinicalText("Hello", "World")).toBe("Hello World");
    });

    it("joins with custom separator", () => {
      expect(joinClinicalText("Hello", "World", " - ")).toBe("Hello - World");
    });

    it("returns only summary when description is null", () => {
      expect(joinClinicalText("Summary only", null)).toBe("Summary only");
    });

    it("returns only description when summary is null", () => {
      expect(joinClinicalText(null, "Description only")).toBe("Description only");
    });

    it("returns empty string when both are null", () => {
      expect(joinClinicalText(null, null)).toBe("");
    });

    it("returns empty string when both are empty strings", () => {
      expect(joinClinicalText("", "")).toBe("");
    });

    it("strips HTML from both parts before joining", () => {
      expect(joinClinicalText("<p>Summary</p>", "<p>Desc</p>")).toBe("Summary Desc");
    });

    it("skips empty normalized parts", () => {
      expect(joinClinicalText("   ", "Description")).toBe("Description");
    });

    it("handles undefined for both", () => {
      expect(joinClinicalText(undefined, undefined)).toBe("");
    });

    it("normalizes HTML entities in both parts", () => {
      expect(joinClinicalText("cats &amp; dogs", "birds &amp; fish")).toBe(
        "cats & dogs birds & fish",
      );
    });

    it("uses newline separator correctly", () => {
      expect(joinClinicalText("line1", "line2", "\n")).toBe("line1\nline2");
    });
  });

  describe("normalizeClinicalTextLower", () => {
    it("returns empty string for null", () => {
      expect(normalizeClinicalTextLower(null)).toBe("");
    });

    it("lowercases plain text", () => {
      expect(normalizeClinicalTextLower("HELLO WORLD")).toBe("hello world");
    });

    it("lowercases after stripping HTML", () => {
      expect(normalizeClinicalTextLower("<p>ALLERGIC</p>")).toBe("allergic");
    });

    it("lowercases decoded entities", () => {
      expect(normalizeClinicalTextLower("CATS &amp; DOGS")).toBe("cats & dogs");
    });

    it("returns empty string for empty string", () => {
      expect(normalizeClinicalTextLower("")).toBe("");
    });

    it("handles mixed case", () => {
      expect(normalizeClinicalTextLower("Hello World")).toBe("hello world");
    });
  });
});
