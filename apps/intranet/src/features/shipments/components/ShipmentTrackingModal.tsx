// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Button, Chip, Description, Label, Modal, ScrollShadow, Skeleton } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  PackageCheck,
  PackageX,
  RefreshCw,
  Truck,
} from "lucide-react";
import type { ComponentType } from "react";
import { trackShipment } from "../api";

interface ShipmentTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: number | null;
  otNumber: string | null;
}

// Maps Chilexpress event names to a lucide icon + semantic color. The
// names below were captured from live tracking responses; unmapped
// events fall back to the neutral Activity icon so nothing crashes.
type EventStyle = {
  Icon: ComponentType<{ size?: number; className?: string }>;
  color: "success" | "warning" | "danger" | "accent" | "default";
};

function styleForEvent(name: string | null | undefined): EventStyle {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("entreg")) return { Icon: PackageCheck, color: "success" };
  if (lower.includes("rechaz") || lower.includes("devolu") || lower.includes("fallid"))
    return { Icon: PackageX, color: "danger" };
  if (lower.includes("reparto") || lower.includes("ruta") || lower.includes("trans"))
    return { Icon: Truck, color: "accent" };
  if (lower.includes("admitid") || lower.includes("recep") || lower.includes("ingres"))
    return { Icon: Package, color: "accent" };
  if (lower.includes("pendiente") || lower.includes("espera"))
    return { Icon: Clock, color: "warning" };
  return { Icon: Activity, color: "default" };
}

function statusChipColor(
  ref: string | null | undefined
): "success" | "warning" | "danger" | "accent" | "default" {
  const lower = (ref ?? "").toUpperCase();
  if (["E", "ENT", "DELIVERED"].some((k) => lower.includes(k))) return "success";
  if (["R", "REC", "DEV", "RET"].some((k) => lower.includes(k))) return "danger";
  if (["T", "RUTA", "TRA"].some((k) => lower.includes(k))) return "accent";
  if (["P", "ESP"].some((k) => lower.includes(k))) return "warning";
  return "default";
}

export function ShipmentTrackingModal({
  isOpen,
  onClose,
  shipmentId,
  otNumber,
}: Readonly<ShipmentTrackingModalProps>) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["shipment-tracking", shipmentId],
    queryFn: () => trackShipment(shipmentId!),
    enabled: isOpen && shipmentId != null,
    staleTime: 1000 * 30,
  });

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="flex items-center gap-2 font-bold text-primary text-xl">
                <Activity size={20} />
                Tracking de OT {otNumber}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {isLoading ? (
                <TrackingSkeleton />
              ) : !data ? (
                <p className="text-center text-default-500">Sin información de tracking.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-default-100 bg-default-50 px-4 py-3">
                    <Chip
                      color={statusChipColor(data.tracking.statusCodeReference)}
                      size="sm"
                      variant="soft"
                    >
                      <Chip.Label>{data.tracking.statusCodeReference ?? "—"}</Chip.Label>
                    </Chip>
                    <Label>{data.tracking.statusDescription ?? "Sin estado"}</Label>
                  </div>

                  {data.tracking.events.length === 0 ? (
                    <p className="text-default-500 text-sm">Sin eventos registrados aún.</p>
                  ) : (
                    <ScrollShadow
                      orientation="vertical"
                      size={32}
                      hideScrollBar
                      className="max-h-[55vh] overflow-y-auto"
                    >
                      <TimelineList events={data.tracking.events} />
                    </ScrollShadow>
                  )}
                </>
              )}

              <div className="flex justify-between gap-2 border-default-100 border-t pt-3">
                <Button
                  isDisabled={isFetching}
                  isPending={isFetching}
                  onPress={() => void refetch()}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw size={14} />
                  Refrescar
                </Button>
                <Button onPress={onClose} variant="primary">
                  Cerrar
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function TimelineList({
  events,
}: {
  events: Array<{ name?: string | null; location?: string | null; date?: string | null }>;
}) {
  // Most recent at top. We mark the freshest event as "current" with a
  // pulsing CheckCircle2 ring so the operator's eye lands on it.
  return (
    <ol aria-label="Eventos de tracking" className="relative space-y-3 pl-7">
      <span aria-hidden className="absolute top-2 bottom-2 left-3 w-px bg-default-200" />
      {events.map((e, i) => {
        const isCurrent = i === 0;
        const { Icon, color } = styleForEvent(e.name);
        return (
          <li key={`${i}-${e.date ?? e.name ?? "ev"}`} className="relative">
            <span
              aria-hidden
              className={`absolute -left-7 top-0.5 inline-flex size-6 items-center justify-center rounded-full ring-2 ${
                isCurrent ? "ring-success" : "ring-default-200"
              } bg-content1`}
            >
              {isCurrent ? (
                <CheckCircle2 size={14} className="text-success" aria-hidden />
              ) : (
                <Icon size={12} aria-hidden className="text-default-500" />
              )}
            </span>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Label className="text-sm">{e.name ?? "Evento"}</Label>
                <Chip color={color} size="sm" variant="soft">
                  <Chip.Label>{isCurrent ? "Actual" : "Histórico"}</Chip.Label>
                </Chip>
              </div>
              {e.location ? (
                <Description className="flex items-center gap-1 text-xs">
                  <MapPin size={11} className="text-default-400" />
                  {e.location}
                </Description>
              ) : null}
              {e.date ? (
                <Description className="text-default-400 text-xs">{e.date}</Description>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TrackingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-3 pl-7">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
            <Skeleton className="ml-8 h-2.5 w-44 rounded" />
            <Skeleton className="ml-8 h-2.5 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
