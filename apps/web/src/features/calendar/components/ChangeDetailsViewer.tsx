import { ChevronDown, FileCheck, FileDiff, FileMinus, FileQuestion, FileX } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChangeDetail {
  action?: string;
  eventId?: string;
  fields?: string[];
  summary?: string;
}

export const ChangeDetailsViewer = ({ data }: { data: unknown }) => {
  if (!data) return null;

  const rawDetails = data as {
    excluded?: string[];
    inserted?: string[];
    updated?: (string | { changes: string[]; summary: string })[];
  };

  const details: ChangeDetail[] = [];

  // Transform inserted
  if (rawDetails.inserted && Array.isArray(rawDetails.inserted)) {
    for (const summary of rawDetails.inserted) {
      details.push({ action: "created", summary });
    }
  }

  // Transform updated
  if (rawDetails.updated && Array.isArray(rawDetails.updated)) {
    for (const item of rawDetails.updated) {
      if (typeof item === "string") {
        details.push({ action: "updated", summary: item });
      } else {
        details.push({ action: "updated", fields: item.changes, summary: item.summary });
      }
    }
  }

  // Transform excluded
  if (rawDetails.excluded && Array.isArray(rawDetails.excluded)) {
    for (const summary of rawDetails.excluded) {
      details.push({ action: "deleted", summary });
    }
  }

  if (details.length === 0) {
    return (
      <div className="bg-base-200/30 flex items-center justify-center rounded-lg border border-dashed p-4 text-xs italic text-base-content/50">
        No hay detalles de cambios registrados.
      </div>
    );
  }

  // Group by action
  const grouped: Record<string, ChangeDetail[]> = {};
  for (const item of details) {
    const action = item.action ?? "unknown";
    grouped[action] ??= [];
    grouped[action].push(item);
  }

  const config: Record<
    string,
    {
      label: string;
      color: "success" | "primary" | "danger" | "warning" | "default";
      icon: React.ElementType;
    }
  > = {
    created: { label: "Insertados", color: "success", icon: FileCheck },
    updated: { label: "Modificados", color: "primary", icon: FileDiff },
    deleted: { label: "Eliminados", color: "danger", icon: FileX },
    skipped: { label: "Omitidos", color: "warning", icon: FileMinus },
    unknown: { label: "Otros", color: "default", icon: FileQuestion },
  };

  return (
    <details className="group bg-base-100/50 border-base-200 overflow-hidden rounded-xl border transition-all duration-200 open:shadow-sm">
      <summary className="hover:bg-base-200/50 flex cursor-pointer select-none items-center justify-between px-4 py-3 transition-colors">
        <span className="font-medium text-sm">Detalle de Cambios</span>
        <ChevronDown className="text-base-content/40 h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-base-200 border-t bg-base-100">
        <div className="flex flex-col gap-6 p-4">
          {Object.entries(grouped).map(([action, items]) => {
            const cfg = config[action] || config.unknown;
            const Icon = cfg.icon;

            return (
              <div key={action} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      cfg.color === "success" && "text-success",
                      cfg.color === "primary" && "text-info", // Changed to info for better visibility in light mode? Or keep primary? User screenshot has 'MODIFICADOS' in gray pill?
                      // Actually screenshot shows 'MODIFICADOS (1)' in a gray/light pill.
                      // I will stick to my color mapping but maybe softer.
                      cfg.color === "danger" && "text-error",
                      cfg.color === "warning" && "text-warning",
                      cfg.color === "default" && "text-base-content/70",
                    )}
                  >
                    {cfg.label} ({items.length})
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={`${action}-${idx}`}
                      className="bg-base-200/30 border-base-200 flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-base-200/50"
                    >
                      <div
                        className={cn(
                          "mt-0.5 rounded-full p-1",
                          cfg.color === "success" && "bg-success/10 text-success",
                          cfg.color === "primary" && "bg-info/10 text-info", // primary usually blue/indigo. info is cyan/sky.
                          cfg.color === "danger" && "bg-error/10 text-error",
                          cfg.color === "warning" && "bg-warning/10 text-warning",
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-base-content/90 break-words leading-snug">
                          {item.summary ?? item.eventId ?? "Sin título"}
                        </div>
                        {item.fields && item.fields.length > 0 && (
                          <div className="text-base-content/60 font-mono text-xs break-all whitespace-pre-wrap">
                            {item.fields.join("\n")}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
};
