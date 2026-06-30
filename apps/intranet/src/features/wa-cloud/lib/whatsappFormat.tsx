import type { ReactNode } from "react";

// Render WhatsApp text formatting as React nodes so message bubbles show
// *bold*, _italic_, ~strikethrough~ and ```monospace``` the way WhatsApp does,
// instead of the literal markers. Markers are single-char (triple backtick for
// monospace) and non-nested — matching how WhatsApp renders these templates.
// Newlines are preserved by the caller's `whitespace-pre-wrap`.
const TOKEN = /(```[^`]+```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function formatWhatsAppText(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (!part) return null;
    const key = `${i}-${part.slice(0, 4)}`;
    if (part.length >= 6 && part.startsWith("```") && part.endsWith("```")) {
      return (
        <code key={key} className="rounded bg-black/10 px-1 font-mono text-[0.9em]">
          {part.slice(3, -3)}
        </code>
      );
    }
    const inner = part.slice(1, -1);
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <strong key={key} className="font-semibold">
          {inner}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_")) return <em key={key}>{inner}</em>;
    if (part.startsWith("~") && part.endsWith("~")) return <s key={key}>{inner}</s>;
    return part;
  });
}
