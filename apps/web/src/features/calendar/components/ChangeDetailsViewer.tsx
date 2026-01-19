import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChangeDetail {
  action?: string;
  eventId?: string;
  fields?: string[];
  summary?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy component
export const ChangeDetailsViewer = ({ data }: { data: unknown }) => {
  if (!data) return null;

  // Backend sends: { inserted: string[], updated: (string | {summary, changes})[], excluded: string[] }
  // Component expects: ChangeDetail[] with action field
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
    return <p className="text-base-content/50 text-sm italic">No hay cambios detallados.</p>;
  }

  // Group by action (safe - action is a controlled string from data)
  const grouped: Record<string, ChangeDetail[]> = {};
  for (const item of details) {
    const action = item.action ?? "unknown";
    // eslint-disable-next-line security/detect-object-injection
    grouped[action] ??= [];
    // eslint-disable-next-line security/detect-object-injection
    grouped[action].push(item);
  }

  const actionLabels: Record<string, { color: string; label: string }> = {
    created: { color: "text-success", label: "Insertados" },
    deleted: { color: "text-error", label: "Eliminados" },
    skipped: { color: "text-warning", label: "Omitidos" },
    unknown: { color: "text-base-content/70", label: "Otros" },
    updated: { color: "text-info", label: "Modificados" },
  };

  return (
    <details className="group bg-base-100/50 border-base-200 open:bg-base-100 overflow-hidden rounded-lg border">
      <summary className="hover:bg-base-200 flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-medium transition-colors select-none">
        <span>Ver Detalle de Cambios ({details.length})</span>
        <ChevronDown className="h-3 w-3 opacity-50 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="border-base-200 space-y-3 border-t p-3">
        {Object.entries(grouped).map(([action, items]) => {
          // eslint-disable-next-line security/detect-object-injection
          const lookup = actionLabels[action];
          const label = lookup?.label ?? "Otros";
          const color = lookup?.color ?? "text-base-content/70";
          return (
            <div key={action}>
              <h5 className={cn("mb-1.5 text-xs font-semibold tracking-wide uppercase", color)}>
                {label} ({items.length})
              </h5>
              <div className="bg-base-200/50 max-h-40 space-y-1 overflow-y-auto rounded-lg p-2">
                {items.slice(0, 50).map((item, idx) => (
                  <div
                    className="border-base-300 flex items-start gap-2 border-b pb-1 text-xs last:border-0"
                    // biome-ignore lint/suspicious/noArrayIndexKey: simple list
                    key={idx}
                  >
                    <span className="text-base-content/70 flex-1 truncate" title={item.summary}>
                      {item.summary ?? item.eventId ?? "Sin título"}
                    </span>
                    {item.fields && item.fields.length > 0 && (
                      <span className="text-base-content/50 shrink-0 font-mono">
                        [{item.fields.join(", ")}]
                      </span>
                    )}
                  </div>
                ))}
                {items.length > 50 && (
                  <p className="text-base-content/50 pt-1 text-center text-xs">
                    ...y {items.length - 50} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
};
