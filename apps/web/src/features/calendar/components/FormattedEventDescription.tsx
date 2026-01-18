import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";

interface FormattedEventDescriptionProps {
  className?: string;
  text: string;
}

export function FormattedEventDescription({ className, text }: Readonly<FormattedEventDescriptionProps>) {
  const htmlContent = (() => {
    let html = text;

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
    html = html.replaceAll(pattern, '<span class="font-bold text-base-content/80">$1:</span>');

    // 2. Highlight and separate DATOS BOLETA specifically
    html = html.replaceAll(
      "DATOS BOLETA",
      '<div class="mt-3 mb-1 font-bold text-base-content uppercase tracking-wide border-t border-base-200 pt-2">Datos Boleta</div>'
    );

    // 3. Remove empty spans (cleanup)
    html = html.replaceAll(/<span>\s*<\/span>/g, "");

    // 4. Sanitize to prevent XSS attacks
    return DOMPurify.sanitize(html, {
      ALLOWED_ATTR: ["class", "href", "target", "rel"],
      ALLOWED_TAGS: ["span", "div", "a", "br", "strong", "em", "ul", "li"],
    });
  })();

  return (
    <div
      className={cn(
        "[&_a]:text-primary text-base-content/60 text-xs leading-relaxed font-normal transition-all [&_a]:underline",
        className
      )}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
