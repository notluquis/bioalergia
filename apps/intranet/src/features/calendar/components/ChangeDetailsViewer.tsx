import { Accordion } from "@heroui/react";
import { FileCheck, FileDiff, FileMinus, FileQuestion, FileX } from "lucide-react";

import { cn } from "@/lib/utils";

interface ChangeDetail {
  action?: string;
  eventId?: string;
  fields?: string[];
  summary?: string;
}

const ACTION_CONFIG: Record<
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

function ChangeGroup({ action, items }: Readonly<{ action: string; items: ChangeDetail[] }>) {
  const cfg = ACTION_CONFIG[action] || ACTION_CONFIG.unknown;
  if (!cfg) {
    return null;
  }
  const Icon = cfg.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-bold text-xs uppercase tracking-wider",
            cfg.color === "success" && "text-success",
            cfg.color === "primary" && "text-info",
            cfg.color === "danger" && "text-danger",
            cfg.color === "warning" && "text-warning",
            cfg.color === "default" && "text-foreground-500",
          )}
        >
          {cfg.label}
        </span>
        <div className="h-px flex-1 bg-default-100" />
      </div>
      <div className="space-y-4">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: display list only
          <div key={i} className="flex gap-3">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-content1 shadow-sm",
                cfg.color === "success" && "border-success-200 text-success",
                cfg.color === "primary" && "border-primary-200 text-info",
                cfg.color === "danger" && "border-danger-200 text-danger",
                cfg.color === "warning" && "border-warning-200 text-warning",
                cfg.color === "default" && "border-default-200 text-foreground-500",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-1 py-1">
              <p className="text-foreground-600 text-sm leading-relaxed">{item.summary}</p>
              {item.fields && item.fields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {item.fields.map((field) => (
                    <span
                      key={field}
                      className="rounded bg-default-100 px-1.5 py-0.5 font-medium text-[10px] text-foreground-500"
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
}

const buildDetailsFromRaw = (rawDetails: {
  excluded?: string[];
  inserted?: string[];
  updated?: (string | { changes: string[]; summary: string })[];
}): ChangeDetail[] => {
  const details: ChangeDetail[] = [];

  if (Array.isArray(rawDetails.inserted)) {
    for (const summary of rawDetails.inserted) {
      details.push({ action: "created", summary });
    }
  }

  if (Array.isArray(rawDetails.updated)) {
    for (const item of rawDetails.updated) {
      if (typeof item === "string") {
        details.push({ action: "updated", summary: item });
      } else {
        details.push({ action: "updated", fields: item.changes, summary: item.summary });
      }
    }
  }

  if (Array.isArray(rawDetails.excluded)) {
    for (const summary of rawDetails.excluded) {
      details.push({ action: "deleted", summary });
    }
  }

  return details;
};

const groupDetailsByAction = (details: ChangeDetail[]) => {
  const grouped: Record<string, ChangeDetail[]> = {};

  for (const item of details) {
    const action = item.action ?? "unknown";
    grouped[action] ??= [];
    grouped[action].push(item);
  }

  return grouped;
};

export const ChangeDetailsViewer = ({ data }: { data: unknown }) => {
  if (!data) {
    return null;
  }

  const rawDetails = data as {
    excluded?: string[];
    inserted?: string[];
    updated?: (string | { changes: string[]; summary: string })[];
  };

  const details = buildDetailsFromRaw(rawDetails);

  if (details.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed bg-default-100/30 p-4 text-foreground-500 text-xs italic">
        No hay detalles de cambios registrados.
      </div>
    );
  }

  const grouped = groupDetailsByAction(details);

  return (
    <Accordion
      className="overflow-hidden rounded-xl border border-default-200 bg-content1/50 p-0 shadow-none transition-all duration-200"
      hideSeparator
      variant="default"
    >
      <Accordion.Item key="change-details" aria-label="Detalle de Cambios" className="px-0">
        <Accordion.Heading>
          <Accordion.Trigger className="px-4 py-3 transition-colors hover:bg-default-100/50 data-[hover=true]:bg-default-100/50">
            <span className="font-medium text-sm">Detalle de Cambios</span>
            <Accordion.Indicator className="text-foreground-400" />
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel className="pb-0">
          <Accordion.Body className="p-0">
            <div className="border-default-200 border-t bg-content1">
              <div className="flex flex-col gap-6 p-4">
                {Object.entries(grouped).map(([action, items]) => (
                  <ChangeGroup key={action} action={action} items={items} />
                ))}
              </div>
            </div>
          </Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
};
