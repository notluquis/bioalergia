import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { FileCheck2, FileText, PackagePlus } from "lucide-react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { closeManifest, fetchActiveManifest, openManifest } from "../api";

// Descarga el PDF del manifiesto (base64) que Chilexpress devuelve al cerrar
// el certificado. imagePdf es el PDF; binaryImage es un fallback de imagen.
function downloadManifestPdf(certificateNumber: string, base64Pdf: string) {
  const byteChars = atob(base64Pdf);
  const byteNums = Array.from({ length: byteChars.length }, (_, i) => byteChars.charCodeAt(i));
  const blob = new Blob([new Uint8Array(byteNums)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manifiesto-${certificateNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ManifestPanel() {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["shipment-manifest-active"],
    queryFn: fetchActiveManifest,
    staleTime: 1000 * 30,
  });

  const active = data?.active ?? null;

  const openMutation = useMutation({
    mutationFn: openManifest,
    onError: (e) => toastError(e instanceof Error ? e.message : "Error al abrir manifiesto"),
    onSuccess: (res) => {
      success(
        res.alreadyOpen
          ? `Ya había un manifiesto abierto (#${res.certificateNumber})`
          : `Manifiesto #${res.certificateNumber} abierto`
      );
      void queryClient.invalidateQueries({ queryKey: ["shipment-manifest-active"] });
    },
  });

  const closeMutation = useMutation({
    // Pasamos el certificateNumber que la UI ya muestra en vez de depender de
    // que el server re-lea el KV (evita "No hay manifiesto activo" por desync).
    mutationFn: (certificateNumber?: string) =>
      closeManifest(certificateNumber ? { certificateNumber } : undefined),
    onError: (e) => toastError(e instanceof Error ? e.message : "Error al cerrar manifiesto"),
    onSuccess: (res) => {
      const pdf = res.imagePdf ?? res.binaryImage;
      if (pdf) {
        downloadManifestPdf(
          res.certificateNumber ?? active?.certificateNumber ?? "manifiesto",
          pdf
        );
      }
      success(`Manifiesto cerrado${res.amountOfPieces ? ` · ${res.amountOfPieces} pieza(s)` : ""}`);
      void queryClient.invalidateQueries({ queryKey: ["shipment-manifest-active"] });
      void queryClient.invalidateQueries({ queryKey: ["shipments-all"] });
    },
  });

  async function handleClose() {
    const ok = await confirmAction({
      title: "Cerrar manifiesto del día",
      description:
        "Se cerrará el certificado en Chilexpress y se descargará el PDF. Las OTs asociadas quedan agrupadas y ya no se pueden alterar. No se puede reabrir.",
      confirmLabel: "Cerrar y descargar PDF",
      variant: "danger",
    });
    if (ok) closeMutation.mutate(active?.certificateNumber);
  }

  if (isLoading) {
    return (
      <Card variant="secondary" aria-busy="true" aria-label="Cargando manifiesto">
        <Card.Content className="flex items-center gap-3 py-4">
          <Spinner size="sm" aria-hidden="true" />
          <span className="text-default-500 text-sm">Cargando manifiesto…</span>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card variant="secondary">
      <Card.Header className="flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-primary" aria-hidden="true" />
          <Card.Title className="text-base">Manifiesto del día</Card.Title>
          {active ? (
            <Chip size="sm" variant="soft" color="success">
              <Chip.Label>Abierto · #{active.certificateNumber}</Chip.Label>
            </Chip>
          ) : (
            <Chip size="sm" variant="soft" color="default">
              <Chip.Label>Sin abrir</Chip.Label>
            </Chip>
          )}
        </div>
        {active ? (
          <Button
            size="sm"
            variant="danger"
            className="gap-2"
            isDisabled={closeMutation.isPending}
            isPending={closeMutation.isPending}
            onPress={() => void handleClose()}
          >
            <FileCheck2 size={16} />
            Cerrar y descargar PDF
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-2"
            isDisabled={openMutation.isPending}
            isPending={openMutation.isPending}
            onPress={() => openMutation.mutate()}
          >
            <PackagePlus size={16} />
            Abrir manifiesto
          </Button>
        )}
      </Card.Header>
      <Card.Content>
        <Card.Description>
          {active
            ? `Abierto ${dayjs(active.openedAt).format("DD/MM/YYYY HH:mm")}. Cada despacho nuevo se agrupa en este manifiesto hasta que lo cierres.`
            : "Abre un manifiesto para agrupar los despachos del día. Mientras esté abierto, cada OT creada queda asociada; al cerrarlo se genera el PDF para entregar el lote al courier."}
        </Card.Description>
      </Card.Content>
    </Card>
  );
}
