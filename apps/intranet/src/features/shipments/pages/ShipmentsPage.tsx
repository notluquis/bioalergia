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
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { PackageCheck, PlusCircle, Truck, UserPlus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { fetchPatients } from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { fetchAllShipments } from "../api";
import { CreateShipmentWizard } from "../components/CreateShipmentWizard";

type Shipment = Awaited<ReturnType<typeof fetchAllShipments>>["shipments"][number];
type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const STATUS_COLOR: Record<string, "success" | "warning" | "default"> = {
  CREATED: "success",
  PENDING: "warning",
};

const columns: ColumnDef<Shipment>[] = [
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
  {
    id: "label",
    cell: ({ row }) =>
      row.original.labelBase64 ? (
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={() => downloadLabel(row.original.otNumber, row.original.labelBase64!)}
        >
          <PackageCheck size={16} />
        </Button>
      ) : null,
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
                  <SearchField.Input autoFocus placeholder="Buscar por nombre o RUT..." />
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
                <Button size="sm" variant="ghost" className="w-full gap-2" onPress={onCreateNew}>
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
  const [selectPatientOpen, setSelectPatientOpen] = useState(false);
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shipments-all"],
    queryFn: fetchAllShipments,
    staleTime: 1000 * 60,
  });

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck size={24} className="text-primary" />
          <div>
            <h1 className="font-bold text-xl">Despachos</h1>
            <p className="text-default-500 text-sm">
              {data?.shipments.length ?? 0} despacho(s) en total
            </p>
          </div>
        </div>
        <Button size="sm" className="gap-2" onPress={() => setSelectPatientOpen(true)}>
          <PlusCircle size={16} />
          Nuevo Despacho
        </Button>
      </div>

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
    </div>
  );
}
