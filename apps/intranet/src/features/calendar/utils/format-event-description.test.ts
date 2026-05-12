import { describe, expect, it } from "vitest";
import { formatEventDescriptionToPlainText } from "./format-event-description";

describe("formatEventDescriptionToPlainText", () => {
  it("returns empty string for empty input", () => {
    expect(formatEventDescriptionToPlainText("")).toBe("");
  });

  it("returns plain text unchanged (no HTML)", () => {
    expect(formatEventDescriptionToPlainText("Hola mundo")).toBe("Hola mundo");
  });

  it("strips basic HTML tags", () => {
    expect(formatEventDescriptionToPlainText("<p>hello</p>")).toBe("hello");
  });

  it("converts <br> to newline", () => {
    const result = formatEventDescriptionToPlainText("line1<br>line2");
    expect(result).toBe("line1\nline2");
  });

  it("converts <br /> to newline", () => {
    const result = formatEventDescriptionToPlainText("line1<br />line2");
    expect(result).toBe("line1\nline2");
  });

  it("converts <p> boundaries to newlines and trims extra blank lines", () => {
    const result = formatEventDescriptionToPlainText("<p>first</p><p>second</p>");
    expect(result).toContain("first");
    expect(result).toContain("second");
  });

  it("converts <li> items to dash-prefixed lines", () => {
    const result = formatEventDescriptionToPlainText("<ul><li>item1</li><li>item2</li></ul>");
    expect(result).toContain("- item1");
    expect(result).toContain("- item2");
  });

  it("decodes &amp; entity", () => {
    expect(formatEventDescriptionToPlainText("A &amp; B")).toBe("A & B");
  });

  it("decodes &lt; and &gt; entities", () => {
    expect(formatEventDescriptionToPlainText("&lt;tag&gt;")).toBe("<tag>");
  });

  it("decodes &quot; entity", () => {
    expect(formatEventDescriptionToPlainText("&quot;quoted&quot;")).toBe('"quoted"');
  });

  it("decodes &#39; entity", () => {
    expect(formatEventDescriptionToPlainText("it&#39;s")).toBe("it's");
  });

  it("decodes &nbsp; as space", () => {
    const result = formatEventDescriptionToPlainText("a&nbsp;b");
    expect(result).toBe("a b");
  });

  it("collapses multiple blank lines into a single blank line", () => {
    const result = formatEventDescriptionToPlainText("a\n\n\n\nb");
    expect(result).not.toMatch(/\n{3,}/);
  });

  it("strips disallowed tags like <script>", () => {
    const result = formatEventDescriptionToPlainText('<script>alert("x")</script>text');
    expect(result).not.toContain("<script>");
    expect(result).toContain("text");
  });

  it("keeps strong text content (strips tag, keeps text)", () => {
    expect(formatEventDescriptionToPlainText("<strong>bold</strong>")).toBe("bold");
  });

  it("handles nested HTML without crashing", () => {
    const html = "<div><p><strong>A</strong> <em>B</em></p></div>";
    const result = formatEventDescriptionToPlainText(html);
    expect(result).toContain("A");
    expect(result).toContain("B");
  });

  it("trims leading and trailing whitespace from final output", () => {
    const result = formatEventDescriptionToPlainText("  <p>  hello  </p>  ");
    expect(result).toBe("hello");
  });

  it("handles plain text with Spanish characters", () => {
    const text = "Niño – Ñoño";
    expect(formatEventDescriptionToPlainText(text)).toBe("Niño – Ñoño");
  });
});
