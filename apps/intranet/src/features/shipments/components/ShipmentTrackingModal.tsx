import { Button, Chip, Description, Label, Modal, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { Activity, MapPin, RefreshCw } from "lucide-react";
import { trackShipment } from "../api";

interface ShipmentTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  shipmentId: number | null;
  otNumber: string | null;
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
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                </div>
              ) : !data ? (
                <p className="text-center text-default-500">Sin información de tracking.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-xl border border-default-100 bg-default-50 px-4 py-3">
                    <Chip color="accent" size="sm" variant="soft">
                      {data.tracking.statusCodeReference ?? "—"}
                    </Chip>
                    <Label>{data.tracking.statusDescription ?? "Sin estado"}</Label>
                  </div>

                  {data.tracking.events.length === 0 ? (
                    <p className="text-default-500 text-sm">Sin eventos registrados aún.</p>
                  ) : (
                    <ol className="space-y-3 border-default-100 border-l-2 pl-4">
                      {data.tracking.events.map((e, i) => (
                        <li key={i} className="relative">
                          <span className="-left-[1.4rem] absolute top-1 inline-block h-3 w-3 rounded-full bg-primary" />
                          <Label>{e.name ?? "Evento"}</Label>
                          {e.location && (
                            <Description className="text-xs">
                              <MapPin size={11} className="mr-1 inline" />
                              {e.location}
                            </Description>
                          )}
                          {e.date && (
                            <Description className="text-default-400 text-xs">{e.date}</Description>
                          )}
                        </li>
                      ))}
                    </ol>
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
