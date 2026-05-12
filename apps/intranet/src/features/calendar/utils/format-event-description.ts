import DOMPurify from "dompurify";

export function formatEventDescriptionToPlainText(text: string): string {
  const sanitizedHtml = DOMPurify.sanitize(text, {
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_TAGS: ["a", "br", "div", "em", "li", "ol", "p", "span", "strong", "ul"],
  });

  const withBreaks = sanitizedHtml
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<\/?(?:div|p|ul|ol)[^>]*>/gi, "\n")
    .replaceAll(/<\/li>/gi, "\n")
    .replaceAll(/<li[^>]*>/gi, "- ");

  let plain = withBreaks.replaceAll(/<[^>]+>/g, "");

  plain = plain
    .replaceAll(/&nbsp;|&#160;/gi, " ")
    .replaceAll(/&amp;/gi, "&")
    .replaceAll(/&lt;/gi, "<")
    .replaceAll(/&gt;/gi, ">")
    .replaceAll(/&quot;/gi, '"')
    .replaceAll(/&#39;/gi, "'");

  plain = plain.replaceAll(/\s+-(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, "\n-");

  const normalizedLines = plain
    .replaceAll(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replaceAll(/\u00A0/g, " ")
        .replaceAll(/[ \t]+/g, " ")
        .trim()
    );

  const compactLines: string[] = [];
  for (const line of normalizedLines) {
    const prev = compactLines.at(-1) ?? "";
    if (line === "" && prev === "") {
      continue;
    }
    compactLines.push(line);
  }

  return compactLines.join("\n").trim();
}
