import { Accordion } from "@heroui/react";
import { FileCheck, FileDiff, FileMinus, FileQuestion, FileX } from "lucide-react";

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
    <Accordion
      className="bg-base-100/50 border-base-200 overflow-hidden rounded-xl border p-0 shadow-none transition-all duration-200"
      hideSeparator
      variant="default"
    >
      <Accordion.Item key="change-details" aria-label="Detalle de Cambios" className="px-0">
        <Accordion.Heading>
          <Accordion.Trigger className="hover:bg-base-200/50 px-4 py-3 transition-colors data-[hover=true]:bg-base-200/50">
            <span className="font-medium text-sm">Detalle de Cambios</span>
            <Accordion.Indicator className="text-base-content/40" />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel className="pb-0">
          <Accordion.Body className="p-0">
            <div className="border-base-200 border-t bg-base-100">
              <div className="flex flex-col gap-6 p-4">
                {Object.entries(grouped).map(([action, items]) => {
                  const cfg = config[action] || config.unknown;
                  if (!cfg) return null;
                  const Icon = cfg.icon;

                  return (
                    <div key={action} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-wider",
                            cfg.color === "success" && "text-success",
                            cfg.color === "primary" && "text-info",
                            cfg.color === "danger" && "text-danger",
                            cfg.color === "warning" && "text-warning",
                            cfg.color === "default" && "text-base-content/60",
                          )}
                        >
                          {cfg.label}
                        </span>
                        <div className="bg-base-200 h-px flex-1" />
                      </div>
                      <div className="space-y-4">
                        {items.map((item, i) => (
                          <div key={i} className="flex gap-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-base-100 shadow-sm",
                                cfg.color === "success" && "border-success/20 text-success",
                                cfg.color === "primary" && "border-info/20 text-info",
                                cfg.color === "danger" && "border-danger/20 text-danger",
                                cfg.color === "warning" && "border-warning/20 text-warning",
                                cfg.color === "default" && "border-base-200 text-base-content/50",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1 py-1">
                              <p className="text-base-content/80 text-sm leading-relaxed">
                                {item.summary}
                              </p>
                              {item.fields && item.fields.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {item.fields.map((field) => (
                                    <span
                                      key={field}
                                      className="bg-base-200 text-base-content/70 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                    >
                                      {field}
                                    </span>
                                  ))}
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
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
};
