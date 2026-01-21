import { Chip, ScrollShadow } from "@heroui/react";
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

  // Calculate summary counts for the header
  const counts = {
    created: grouped.created?.length || 0,
    updated: grouped.updated?.length || 0,
    deleted: grouped.deleted?.length || 0,
  };

  return (
    <details className="group bg-base-100/50 border-base-200 overflow-hidden rounded-xl border transition-all duration-200 open:shadow-sm">
      <summary className="hover:bg-base-200/50 flex cursor-pointer select-none items-center justify-between px-4 py-3 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">Detalle de Cambios</span>

          {/* Concordance Badges (+0 ~1 -0 style) */}
          <div className="flex gap-1.5 opacity-80 group-open:opacity-100 transition-opacity">
            {counts.created > 0 && (
              <Chip
                size="sm"
                variant="flat"
                color="success"
                className="h-5 min-h-0 gap-1 px-1.5 text-[10px] font-bold"
              >
                +{counts.created}
              </Chip>
            )}
            {counts.updated > 0 && (
              <Chip
                size="sm"
                variant="flat"
                color="primary"
                className="h-5 min-h-0 gap-1 px-1.5 text-[10px] font-bold"
              >
                ~{counts.updated}
              </Chip>
            )}
            {counts.deleted > 0 && (
              <Chip
                size="sm"
                variant="flat"
                color="danger"
                className="h-5 min-h-0 gap-1 px-1.5 text-[10px] font-bold"
              >
                -{counts.deleted}
              </Chip>
            )}
            {Object.keys(counts).every((k) => counts[k as keyof typeof counts] === 0) && (
              <span className="text-base-content/40 text-xs">Sin cambios</span>
            )}
          </div>
        </div>
        <ChevronDown className="text-base-content/40 h-4 w-4 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-base-200 border-t bg-base-100">
        <div className="flex flex-col gap-4 p-4">
          {Object.entries(grouped).map(([action, items]) => {
            const cfg = config[action] || config.unknown;
            const Icon = cfg.icon;

            return (
              <div key={action} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    variant="dot"
                    color={cfg.color}
                    className="border-none pl-0 font-semibold uppercase tracking-wider text-[10px]"
                  >
                    {cfg.label} ({items.length})
                  </Chip>
                </div>

                <div className="bg-base-200/30 border-base-200/50 overflow-hidden rounded-lg border">
                  <ScrollShadow className="max-h-60 w-full p-2">
                    <div className="space-y-1">
                      {items.map((item, idx) => (
                        <div
                          key={`${action}-${idx}`}
                          className="hover:bg-base-200/50 flex place-items-start gap-3 rounded bg-transparent p-1.5 text-xs transition-colors"
                        >
                          <Icon
                            className={cn(
                              "size-3.5 shrink-0 mt-0.5 opacity-60",
                              cfg.color === "success" && "text-success",
                              cfg.color === "primary" && "text-primary",
                              cfg.color === "danger" && "text-error",
                              cfg.color === "warning" && "text-warning",
                            )}
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div
                              className="text-base-content/80 font-medium truncate"
                              title={item.summary}
                            >
                              {item.summary ?? item.eventId ?? "Sin título"}
                            </div>
                            {item.fields && item.fields.length > 0 && (
                              <div className="text-base-content/60 font-mono text-[10px]">
                                Modificado: {item.fields.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollShadow>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
};
