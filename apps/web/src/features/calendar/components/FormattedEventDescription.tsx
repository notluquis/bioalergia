import { cn } from "@/lib/utils";

interface FormattedEventDescriptionProps {
  text: string;
  className?: string;
}

export function FormattedEventDescription({ text, className }: FormattedEventDescriptionProps) {
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

    const pattern = new RegExp(`(${keysToBold.join("|")}):`, "gi");
    html = html.replace(pattern, '<span class="font-bold text-base-content/80">$1:</span>');

    // 2. Highlight and separate DATOS BOLETA specifically
    html = html.replace(
      /DATOS BOLETA/g,
      '<div class="mt-3 mb-1 font-bold text-base-content uppercase tracking-wide border-t border-base-200 pt-2">Datos Boleta</div>'
    );

    // 3. Remove empty spans (cleanup)
    html = html.replace(/<span>\s*<\/span>/g, "");

    return html;
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
