import { Card, Chip, Separator, Spinner, Tabs } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Calendar,
  ChevronLeft,
  Clock,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import NewAttachmentModal from "@/features/patients/components/NewAttachmentModal";
import { apiClient } from "@/lib/api-client";

interface Person {
  rut: string;
  names: string;
  fatherName?: string;
  motherName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface Consultation {
  id: number;
  date: string;
  reason: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
}

interface MedicalCertificate {
  id: string;
  issuedAt: string;
  diagnosis: string;
}

interface BudgetItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Budget {
  id: number;
  title: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  status: string;
  notes?: string;
  updatedAt: string;
  items: BudgetItem[];
}

interface PatientPayment {
  id: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

interface PatientAttachment {
  id: number;
  name: string;
  type: string;
  uploadedAt: string;
  driveFileId: string;
}

interface Patient {
  id: number;
  personId: number;
  birthDate: string;
  bloodType?: string;
  notes?: string;
  createdAt: string;
  person: Person;
  consultations: Consultation[];
  medicalCertificates: MedicalCertificate[];
  budgets: Budget[];
  payments: PatientPayment[];
  attachments: PatientAttachment[];
}

export const Route = createFileRoute("/_authed/patients/$id/")({
  staticData: {
    permission: { action: "read", subject: "Patient" },
    breadcrumb: (data: Patient) =>
      `${data?.person?.names} ${data?.person?.fatherName}`.trim() || "Paciente",
  },
  loader: async ({ context: { queryClient }, params: { id } }) => {
    return await queryClient.ensureQueryData({
      queryKey: ["patient", id],
      queryFn: async () => {
        return await apiClient.get<Patient>(`/api/patients/${id}`);
      },
    });
  },
  component: PatientDetailsPage,
});

function PatientDetailsPage() {
  const { id } = useParams({ from: "/_authed/patients/$id/" });
  const navigate = useNavigate();
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      return await apiClient.get<Patient>(`/api/patients/${id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-xl font-bold">Paciente no encontrado</h2>
        <Button variant="ghost" onClick={() => navigate({ to: "/patients" })} className="mt-4">
          Volver a la lista
        </Button>
      </div>
    );
  }

  const age = dayjs().diff(dayjs(patient.birthDate), "year");
  const person = patient.person;

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/patients" })}
            className="rounded-full h-10 w-10 min-w-0 p-0"
          >
            <ChevronLeft size={24} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {person.names} {person.fatherName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-default-500">{person.rut}</span>
              <div className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                {age} años
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            className="gap-2"
            onClick={() =>
              navigate({
                to: "/patients/$id/new-consultation",
                params: { id: String(id) },
              })
            }
          >
            <PlusCircle size={18} />
            Nueva Consulta
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              navigate({
                to: "/certificates/medical",
                search: {
                  patientName: person.names,
                  rut: person.rut,
                  address: person.address || "",
                  birthDate: dayjs(patient.birthDate).format("YYYY-MM-DD"),
                },
              })
            }
          >
            <FileText size={18} />
            Emitir Certificado
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar: Info rápida */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none bg-background shadow-sm overflow-hidden">
            <Card.Content className="p-0">
              <div className="bg-primary/5 p-6 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <User size={40} />
                </div>
                <h3 className="font-bold text-center">Ficha Clínica #{patient.id}</h3>
                <span className="text-xs text-default-400">
                  Registrado el {dayjs(patient.createdAt).format("DD/MM/YYYY")}
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-default-300" />
                    <span className="text-default-700">{person.email || "Sin correo"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-default-300" />
                    <span className="text-default-700 text-sm font-mono">
                      {person.phone || "Sin teléfono"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-default-300" />
                    <span className="text-default-700">{person.address || "Sin dirección"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm border-t border-default-100 pt-3">
                    <Clock size={16} className="text-default-300" />
                    <span className="text-default-600">Grupo Sanguíneo: </span>
                    <span className="font-bold text-primary">{patient.bloodType || "DA"}</span>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-default-300">
                    Notas
                  </h4>
                  <p className="text-sm text-default-600 italic bg-default-50/30 p-3 rounded-lg">
                    {patient.notes || "No hay notas clínicas registradas."}
                  </p>
                </div>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Main: Tabs Content */}
        <div className="lg:col-span-2">
          <Tabs aria-label="Patient details tabs">
            <Tabs.List className="no-scrollbar flex w-full gap-4 overflow-x-auto border-b border-divider pb-1">
              <Tabs.Tab id="history" className="gap-2 font-semibold min-w-max">
                <Calendar size={18} />
                <span>Consultas</span>
              </Tabs.Tab>

              <Tabs.Tab id="certificates" className="gap-2 font-semibold min-w-max">
                <FileText size={18} />
                <span>Certificados</span>
              </Tabs.Tab>

              <Tabs.Tab id="budgets" className="gap-2 font-semibold min-w-max">
                <DollarSign size={18} />
                <span>Presupuestos</span>
              </Tabs.Tab>

              <Tabs.Tab id="payments" className="gap-2 font-semibold min-w-max">
                <PlusCircle size={18} />
                <span>Pagos</span>
              </Tabs.Tab>

              <Tabs.Tab id="docs" className="gap-2 font-semibold min-w-max">
                <FileText size={18} />
                <span>Documentos</span>
              </Tabs.Tab>

              <Tabs.Tab id="info" className="gap-2 font-semibold min-w-max">
                <User size={18} />
                <span>Info Detallada</span>
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel id="history" className="py-4">
              <DataTable
                columns={consultationColumns}
                data={patient.consultations || []}
                enablePagination={false}
                enableToolbar={false}
                noDataMessage="No hay consultas registradas para este paciente."
              />
            </Tabs.Panel>

            <Tabs.Panel id="certificates" className="py-4">
              <DataTable
                columns={certificateColumns}
                data={patient.medicalCertificates || []}
                enablePagination={false}
                enableToolbar={false}
                noDataMessage="No se han emitido certificados a este paciente."
              />
            </Tabs.Panel>

            <Tabs.Panel id="budgets" className="py-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    navigate({
                      to: "/patients/$id/new-budget",
                      params: { id: String(id) },
                    })
                  }
                >
                  <PlusCircle size={16} />
                  Nuevo Presupuesto
                </Button>
              </div>
              <DataTable
                columns={budgetColumns}
                data={patient.budgets || []}
                enablePagination={false}
                enableToolbar={false}
                noDataMessage="No hay presupuestos registrados."
              />
            </Tabs.Panel>

            <Tabs.Panel id="payments" className="py-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    navigate({
                      to: "/patients/$id/new-payment",
                      params: { id: String(id) },
                    })
                  }
                >
                  <PlusCircle size={16} />
                  Registrar Pago
                </Button>
              </div>
              <DataTable
                columns={paymentColumns}
                data={patient.payments || []}
                enablePagination={false}
                enableToolbar={false}
                noDataMessage="No hay pagos registrados."
              />
            </Tabs.Panel>

            <Tabs.Panel id="docs" className="py-4 space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-2"
                  variant="outline"
                  onClick={() => setIsAttachmentModalOpen(true)}
                >
                  <PlusCircle size={16} />
                  Cargar Documento
                </Button>
              </div>
              <DataTable
                columns={attachmentColumns}
                data={patient.attachments || []}
                enablePagination={false}
                enableToolbar={false}
                noDataMessage="No hay documentos adjuntos."
              />
            </Tabs.Panel>

            <Tabs.Panel id="info" className="py-4">
              <Card className="border-none bg-background shadow-sm">
                <Card.Content className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailRow label="Nombres" value={person.names} />
                    <DetailRow
                      label="Apellidos"
                      value={`${person.fatherName} ${person.motherName}`}
                    />
                    <DetailRow label="RUT" value={person.rut} />
                    <DetailRow
                      label="Fecha Nacimiento"
                      value={dayjs(patient.birthDate).format("DD/MM/YYYY")}
                    />
                    <DetailRow label="Email" value={person.email || "N/A"} />
                    <DetailRow label="Teléfono" value={person.phone || "N/A"} />
                    <DetailRow
                      label="Dirección"
                      value={person.address || "N/A"}
                      className="md:col-span-2"
                    />
                  </div>
                </Card.Content>
              </Card>
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>

      <NewAttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        patientId={String(patient.id)}
      />
    </section>
  );
}

function DetailRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      <span className="text-xs font-medium text-default-400 uppercase tracking-wider">{label}</span>
      <p className="text-foreground font-medium">{value}</p>
    </div>
  );
}

const consultationColumns: ColumnDef<Consultation>[] = [
  {
    header: "Fecha",
    accessorKey: "date",
    cell: ({ row }) => dayjs(row.original.date).format("DD/MM/YYYY"),
  },
  {
    header: "Motivo",
    accessorKey: "reason",
  },
  {
    header: "Diagnóstico",
    accessorKey: "diagnosis",
  },
  {
    id: "actions",
    cell: () => (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" isIconOnly>
          <ExternalLink size={16} />
        </Button>
      </div>
    ),
  },
];

const budgetColumns: ColumnDef<Budget>[] = [
  {
    header: "Título",
    accessorKey: "title",
  },
  {
    header: "Monto Final",
    accessorKey: "finalAmount",
    cell: ({ row }) =>
      new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(
        row.original.finalAmount,
      ),
  },
  {
    header: "Estado",
    accessorKey: "status",
    cell: ({ row }) => (
      <Chip
        size="sm"
        variant="soft"
        color={row.original.status === "Aceptado" ? "success" : "warning"}
      >
        {row.original.status}
      </Chip>
    ),
  },
  {
    header: "Fecha",
    accessorKey: "updatedAt",
    cell: ({ row }) => dayjs(row.original.updatedAt).format("DD/MM/YYYY"),
  },
];

const paymentColumns: ColumnDef<PatientPayment>[] = [
  {
    header: "Fecha",
    accessorKey: "paymentDate",
    cell: ({ row }) => dayjs(row.original.paymentDate).format("DD/MM/YYYY"),
  },
  {
    header: "Monto",
    accessorKey: "amount",
    cell: ({ row }) =>
      new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(
        row.original.amount,
      ),
  },
  {
    header: "Método",
    accessorKey: "paymentMethod",
  },
  {
    header: "Referencia",
    accessorKey: "reference",
  },
];

const attachmentColumns: ColumnDef<PatientAttachment>[] = [
  {
    header: "Nombre",
    accessorKey: "name",
  },
  {
    header: "Tipo",
    accessorKey: "type",
    cell: ({ row }) => <Chip size="sm">{row.original.type}</Chip>,
  },
  {
    header: "Fecha",
    accessorKey: "uploadedAt",
    cell: ({ row }) => dayjs(row.original.uploadedAt).format("DD/MM/YYYY"),
  },
  {
    id: "actions",
    cell: () => (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" isIconOnly>
          <Download size={16} />
        </Button>
        <Button size="sm" variant="ghost" isIconOnly className="text-danger">
          <Trash2 size={16} />
        </Button>
      </div>
    ),
  },
];

const certificateColumns: ColumnDef<MedicalCertificate>[] = [
  {
    header: "Fecha",
    accessorKey: "issuedAt",
    cell: ({ row }) => dayjs(row.original.issuedAt).format("DD/MM/YYYY"),
  },
  {
    header: "Diagnóstico",
    accessorKey: "diagnosis",
  },
];
