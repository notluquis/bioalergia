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
    let html = text;

    // Preserve line breaks from calendar descriptions
    html = html.replace(/\r\n|\n/g, "<br />");

    // 1. Highlight common keys for better readability
    const keysToBold = [
      "Edad",
      "RUT",
      "Motivo de la consulta",
      "Tratamiento usado",
      "Previsión",
      "Comuna",
      "Contacto",
      "Fono",
    ];

    // eslint-disable-next-line security/detect-non-literal-regexp
    const pattern = new RegExp(`(${keysToBold.join("|")}):`, "gi");
    html = html.replaceAll(pattern, '<span class="font-bold text-foreground-600">$1:</span>');

    // 2. Highlight and separate DATOS BOLETA specifically
    html = html.replaceAll(
      "DATOS BOLETA",
      '<div class="mt-3 mb-1 font-bold text-foreground uppercase tracking-wide border-t border-default-200 pt-2">Datos Boleta</div>',
    );

    // 3. Remove empty spans (cleanup)
    html = html.replaceAll(/<span>\s*<\/span>/g, "");

    // 4. Sanitize HTML first
    const sanitizedHtml = DOMPurify.sanitize(html, {
      ALLOWED_ATTR: ["class", "href", "target", "rel"],
      ALLOWED_TAGS: ["span", "div", "a", "br", "strong", "em", "ul", "li"],
    });

    // 5. Convert to plain text while preserving basic line breaks
    const withLineBreaks = sanitizedHtml
      .replaceAll(/<br\s*\/?>/gi, "\n")
      .replaceAll(/<\/div>/gi, "\n");

    return DOMPurify.sanitize(withLineBreaks, {
      ALLOWED_ATTR: [],
      ALLOWED_TAGS: [],
    });
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
