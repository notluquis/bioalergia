import type React from "react";
import { Chip, Description, Surface } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

export type WaNotification = {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentDate: Date | null | undefined;
  appointmentService: string | null | undefined;
  status: "PENDING" | "SENT" | "FAILED" | "DELIVERED" | "READ" | "PLAYED";
  sentAt: Date | null | undefined;
  deliveredAt: Date | null | undefined;
  playedAt?: Date | null | undefined;
  readAt: Date | null | undefined;
  errorMessage: string | null | undefined;
  createdAt: Date;
};

const STATUS_LABELS: Record<WaNotification["status"], string> = {
  DELIVERED: "Entregado",
  FAILED: "Fallido",
  PENDING: "Pendiente",
  PLAYED: "Reproducido",
  READ: "Leído",
  SENT: "Enviado",
};

const STATUS_COLORS: Record<WaNotification["status"], React.ComponentProps<typeof Chip>["color"]> =
  {
    DELIVERED: "accent",
    FAILED: "danger",
    PENDING: "warning",
    PLAYED: "accent",
    READ: "success",
    SENT: "default",
  };

export function StatusBadge({ status }: { status: WaNotification["status"] }) {
  return (
    <Chip color={STATUS_COLORS[status]} size="sm" variant="soft">
      {STATUS_LABELS[status]}
    </Chip>
  );
}

export function ReadyChip({
  falseLabel = "Pendiente",
  trueLabel = "Listo",
  value,
}: {
  falseLabel?: string;
  trueLabel?: string;
  value: boolean;
}) {
  return (
    <Chip color={value ? "success" : "warning"} size="sm" variant="soft">
      {value ? trueLabel : falseLabel}
    </Chip>
  );
}

export function ChecklistRow({
  description,
  icon: Icon,
  ready,
  title,
}: {
  description: string;
  icon: LucideIcon;
  ready: boolean;
  title: string;
}) {
  return (
    <Surface className="flex items-start justify-between gap-3 rounded-2xl border border-default-200 px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
            ready ? "bg-success/12 text-success" : "bg-warning/12 text-warning"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <Description className="text-default-500 text-xs">{description}</Description>
        </div>
      </div>
      <ReadyChip value={ready} />
    </Surface>
  );
}

export function FlowStep({
  body,
  icon: Icon,
  step,
  title,
}: {
  body: string;
  icon: LucideIcon;
  step: string;
  title: string;
}) {
  return (
    <Surface className="rounded-2xl border border-default-200 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <Description className="font-semibold text-xs text-default-400">{step}</Description>
          <p className="font-medium text-sm">{title}</p>
          <Description className="mt-1 text-default-500 text-xs">{body}</Description>
        </div>
      </div>
    </Surface>
  );
}
