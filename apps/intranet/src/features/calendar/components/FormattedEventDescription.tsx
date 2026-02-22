import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";

interface FormattedEventDescriptionProps {
  className?: string;
  text: string;
}

export function FormattedEventDescription({
  className,
  text,
}: Readonly<FormattedEventDescriptionProps>) {
  const plainContent = (() => {
    const sanitizedHtml = DOMPurify.sanitize(text, {
      ALLOWED_ATTR: ["href", "target", "rel"],
      ALLOWED_TAGS: ["a", "br", "div", "em", "li", "ol", "p", "span", "strong", "ul"],
    });

    // Convert common block tags to line breaks before stripping the rest.
    const withBreaks = sanitizedHtml
      .replaceAll(/<br\s*\/?>/gi, "\n")
      .replaceAll(/<\/?(?:div|p|ul|ol)[^>]*>/gi, "\n")
      .replaceAll(/<\/li>/gi, "\n")
      .replaceAll(/<li[^>]*>/gi, "- ");

    // Strip all remaining HTML tags.
    let plain = withBreaks.replaceAll(/<[^>]+>/g, "");

    // Decode non-breaking spaces and common HTML entities.
    plain = plain
      .replaceAll(/&nbsp;|&#160;/gi, " ")
      .replaceAll(/&amp;/gi, "&")
      .replaceAll(/&lt;/gi, "<")
      .replaceAll(/&gt;/gi, ">")
      .replaceAll(/&quot;/gi, '"')
      .replaceAll(/&#39;/gi, "'");

    // Promote bullet-like "-Campo" segments that were glued by many spaces.
    plain = plain.replaceAll(/\s+-(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, "\n-");

    const normalizedLines = plain
      .replaceAll(/\r\n?/g, "\n")
      .split("\n")
      .map((line) =>
        line
          .replaceAll(/\u00A0/g, " ")
          .replaceAll(/[ \t]+/g, " ")
          .trim(),
      );

    // Keep at most one consecutive blank line.
    const compactLines: string[] = [];
    for (const line of normalizedLines) {
      const prev = compactLines.at(-1) ?? "";
      if (line === "" && prev === "") {
        continue;
      }
      compactLines.push(line);
    }

    return compactLines.join("\n").trim();
  })();

  return (
    <div
      className={cn(
        "whitespace-pre-wrap font-normal text-foreground-500 text-xs leading-relaxed transition-all",
        className,
      )}
    >
      {plainContent}
    </div>
  );
}
