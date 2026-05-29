// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import {
  Button,
  Chip,
  Description,
  Label,
  ListBox,
  Modal,
  SearchField,
  Spinner,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Activity, Ban, PackageCheck, PlusCircle, RefreshCw, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useToast } from "@/context/ToastContext";
import { fetchPatients } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { cancelShipment, fetchAllShipments, refreshAllTracking, reprintLabel } from "../api";
import { CreateShipmentWizard } from "../components/CreateShipmentWizard";
import { ManifestPanel } from "../components/ManifestPanel";
import { ShipmentTrackingModal } from "../components/ShipmentTrackingModal";

type Shipment = Awaited<ReturnType<typeof fetchAllShipments>>["shipments"][number];
type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const STATUS_COLOR: Record<string, "success" | "warning" | "danger" | "default"> = {
  CREATED: "success",
  PENDING: "warning",
  CANCELLED: "danger",
};

const baseColumns: ColumnDef<Shipment>[] = [
  {
    header: "OT",
    accessorKey: "otNumber",
    cell: ({ row }) => (
      <span className="font-mono font-medium text-primary text-sm">{row.original.otNumber}</span>
    ),
  },
  {
    header: "Paciente",
    accessorKey: "patientName",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium text-sm">{row.original.patientName}</span>
        <span className="font-mono text-default-400 text-xs">{row.original.patientRut}</span>
      </div>
    ),
  },
  {
    header: "Servicio",
    accessorKey: "serviceDescription",
    cell: ({ row }) => <span className="text-sm">{row.original.serviceDescription}</span>,
  },
  {
    header: "Destinatario",
    accessorKey: "recipientName",
  },
  {
    header: "Sucursal",
    accessorKey: "commercialOfficeName",
    cell: ({ row }) => (
      <span className="text-default-600 text-sm">{row.original.commercialOfficeName}</span>
    ),
  },
  {
    header: "Pago",
    id: "payment",
    cell: ({ row }) =>
      Number(row.original.cashOnDelivery) > 0 ? (
        <Chip size="sm" variant="soft" color="warning">
          Por cobrar {CLP.format(Number(row.original.cashOnDelivery))}
        </Chip>
      ) : (
        <Chip size="sm" variant="soft" color="default">
          Prepagado
        </Chip>
      ),
  },
  {
    header: "Estado",
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status] ?? "default"}>
        {row.original.status}
      </Chip>
    ),
  },
  {
    header: "Fecha",
    accessorKey: "createdAt",
    cell: ({ row }) => dayjs(row.original.createdAt).format("DD/MM/YYYY HH:mm"),
  },
];

function downloadLabel(otNumber: string, base64: string) {
  const byteChars = atob(base64);
  const byteNums = Array.from({ length: byteChars.length }, (_, i) => byteChars.charCodeAt(i));
  const blob = new Blob([new Uint8Array(byteNums)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `etiqueta-${otNumber}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function PatientSelectModal({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (patient: Patient) => void;
  onCreateNew: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () => fetchPatients(search || undefined),
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
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 font-bold text-primary text-xl">
              <Modal.Heading>Seleccionar Paciente</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="gap-4">
              <SearchField
                aria-label="Buscar paciente"
                fullWidth
                onChange={setSearch}
                value={search}
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar por nombre o RUT..." />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>

              <div className="max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-default-400 text-sm">
                    <Spinner size="sm" />
                    Buscando...
                  </div>
                ) : patients.length === 0 ? (
                  <p className="py-4 text-center text-default-400 text-sm">Sin resultados</p>
                ) : (
                  <ListBox
                    aria-label="Pacientes"
                    onAction={(key) => {
                      const patient = patients.find((p) => String(p.id) === String(key));
                      if (patient) onSelect(patient);
                    }}
                    selectionMode="none"
                  >
                    {patients.map((p) => (
                      <ListBox.Item
                        id={String(p.id)}
                        key={p.id}
                        textValue={`${p.person.names} ${p.person.fatherName ?? ""}`}
                      >
                        <Label>
                          {p.person.names} {p.person.fatherName ?? ""}
                        </Label>
                        <Description className="font-mono">{p.person.rut ?? "Sin RUT"}</Description>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                )}
              </div>

              <div className="border-default-100 border-t pt-3">
                <Button size="sm" variant="outline" className="w-full gap-2" onPress={onCreateNew}>
                  <UserPlus size={15} />
                  Registrar nuevo paciente
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function ShipmentsPage() {
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [tracking, setTracking] = useState<{ id: number; otNumber: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipments-all"],
    queryFn: fetchAllShipments,
    staleTime: 1000 * 60,
  });

  const refreshAllMutation = useMutation({
    mutationFn: refreshAllTracking,
    onError: (e) => toastError(e instanceof Error ? e.message : "Error al refrescar estados"),
    onSuccess: (res) => {
      success(`Estados actualizados: ${res.updated}/${res.total}`);
      void queryClient.invalidateQueries({ queryKey: ["shipments-all"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (shipmentId: number) => cancelShipment(shipmentId),
    onError: (e) => toastError(e instanceof Error ? e.message : "Error al cancelar"),
    onSuccess: () => {
      success("Envío cancelado");
      void queryClient.invalidateQueries({ queryKey: ["shipments-all"] });
    },
  });

  const reprintMutation = useMutation({
    mutationFn: (shipmentId: number) => reprintLabel(shipmentId),
    onError: (e) => toastError(e instanceof Error ? e.message : "Error al reimprimir"),
    onSuccess: (res, shipmentId) => {
      if (res.result.label) {
        const ot = data?.shipments.find((s) => s.id === shipmentId)?.otNumber ?? String(shipmentId);
        downloadLabel(ot, res.result.label);
        success("Etiqueta reimpresa");
        void queryClient.invalidateQueries({ queryKey: ["shipments-all"] });
      }
    },
  });

  const columns = useMemo<ColumnDef<Shipment>[]>(
    () => [
      ...baseColumns,
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.labelBase64 && (
              <Button
                aria-label="Descargar etiqueta"
                isIconOnly
                onPress={() => downloadLabel(row.original.otNumber, row.original.labelBase64!)}
                size="sm"
                variant="outline"
              >
                <PackageCheck size={16} />
              </Button>
            )}
            <Button
              aria-label="Reimprimir etiqueta"
              isDisabled={reprintMutation.isPending}
              isIconOnly
              onPress={() => reprintMutation.mutate(row.original.id)}
              size="sm"
              variant="outline"
            >
              <RefreshCw size={16} />
            </Button>
            <Button
              aria-label="Tracking"
              isIconOnly
              onPress={() => setTracking({ id: row.original.id, otNumber: row.original.otNumber })}
              size="sm"
              variant="outline"
            >
              <Activity size={16} />
            </Button>
            {row.original.status !== "CANCELLED" && (
              <Button
                aria-label="Cancelar envío"
                isIconOnly
                isDisabled={cancelMutation.isPending}
                onPress={() => {
                  void (async () => {
                    const ok = await confirmAction({
                      title: "Cancelar envío",
                      description:
                        "Marca el envío como cancelado (no se imprime ni entra al manifiesto). Chilexpress no anula OTs por API: si ya entregaste el bulto al courier, esto NO lo detiene.",
                      confirmLabel: "Cancelar envío",
                      variant: "danger",
                    });
                    if (ok) cancelMutation.mutate(row.original.id);
                  })();
                }}
                size="sm"
                variant="danger"
              >
                <Ban size={16} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [reprintMutation, cancelMutation]
  );

  function handlePatientSelect(patient: Patient) {
    setSelectedPatient(patient);
    setSelectPatientOpen(false);
    setWizardOpen(true);
  }

  function handleCreateNew() {
    setSelectPatientOpen(false);
    setCreatePatientOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-default-500 text-sm">
          {data?.shipments.length ?? 0} despacho(s) en total
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            isDisabled={refreshAllMutation.isPending}
            isPending={refreshAllMutation.isPending}
            onPress={() => refreshAllMutation.mutate()}
          >
            <RefreshCw size={16} />
            Refrescar estados
          </Button>
          <Button size="sm" className="gap-2" onPress={() => setSelectPatientOpen(true)}>
            <PlusCircle size={16} />
            Nuevo Despacho
          </Button>
        </div>
      </div>

      <ManifestPanel />

      <DataTable
        columns={columns}
        data={data?.shipments ?? []}
        enablePagination
        enableToolbar
        isLoading={isLoading}
        noDataMessage="No hay despachos registrados."
        scrollMaxHeight="min(72dvh, 800px)"
      />

      <PatientSelectModal
        isOpen={selectPatientOpen}
        onClose={() => setSelectPatientOpen(false)}
        onSelect={handlePatientSelect}
        onCreateNew={handleCreateNew}
      />

      <CreatePatientModal
        isOpen={createPatientOpen}
        onClose={() => {
          setCreatePatientOpen(false);
          setSelectPatientOpen(true);
        }}
      />

      {wizardOpen && selectedPatient && (
        <CreateShipmentWizard
          isOpen={wizardOpen}
          onClose={() => {
            setWizardOpen(false);
            setSelectedPatient(null);
            void refetch();
          }}
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.person.names} ${selectedPatient.person.fatherName}`.trim()}
        />
      )}

      <ShipmentTrackingModal
        isOpen={tracking != null}
        onClose={() => setTracking(null)}
        otNumber={tracking?.otNumber ?? null}
        shipmentId={tracking?.id ?? null}
      />
    </div>
  );
}
