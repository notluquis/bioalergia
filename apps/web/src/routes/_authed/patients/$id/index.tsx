import { Card, Separator, Spinner, Tabs } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
  Calendar,
  ChevronLeft,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  User,
} from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/_authed/patients/$id/")({
  staticData: {
    permission: { action: "read", subject: "Patient" },
  },
  component: PatientDetailsPage,
});

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
}

function PatientDetailsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header / Breadcrumb */}
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
            <h1 className="text-2xl font-bold text-base-content">
              {person.names} {person.fatherName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-mono text-base-content/60">{person.rut}</span>
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
                // @ts-expect-error - Route tree may not be updated yet
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
          <Card className="border-none bg-base-100 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-primary/5 p-6 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <User size={40} />
                </div>
                <h3 className="font-bold text-center">Ficha Clínica #{patient.id}</h3>
                <span className="text-xs text-base-content/50">
                  Registrado el {dayjs(patient.createdAt).format("DD/MM/YYYY")}
                </span>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-base-content/40" />
                    <span className="text-base-content/80">{person.email || "Sin correo"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-base-content/40" />
                    <span className="text-base-content/80 text-sm font-mono">
                      {person.phone || "Sin teléfono"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-base-content/40" />
                    <span className="text-base-content/80">
                      {person.address || "Sin dirección"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm border-t border-base-200 pt-3">
                    <Clock size={16} className="text-base-content/40" />
                    <span className="text-base-content/70">Grupo Sanguíneo: </span>
                    <span className="font-bold text-primary">{patient.bloodType || "DA"}</span>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                    Notas
                  </h4>
                  <p className="text-sm text-base-content/70 italic bg-base-200/30 p-3 rounded-lg">
                    {patient.notes || "No hay notas clínicas registradas."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main: Tabs Content */}
        <div className="lg:col-span-2">
          <Tabs aria-label="Patient details tabs">
            <Tabs.ListContainer>
              <Tabs.List className="gap-6 w-full relative h-12 border-b border-divider">
                <Tabs.Tab id="history" className="gap-2 font-semibold">
                  <Calendar size={18} />
                  <span>Consultas</span>
                  <Tabs.Indicator />
                </Tabs.Tab>

                <Tabs.Tab id="certificates" className="gap-2 font-semibold">
                  <FileText size={18} />
                  <span>Certificados</span>
                  <Tabs.Indicator />
                </Tabs.Tab>

                <Tabs.Tab id="info" className="gap-2 font-semibold">
                  <User size={18} />
                  <span>Info Detallada</span>
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="history" className="py-4">
              <DataTable
                columns={consultationColumns}
                data={patient.consultations || []}
                noDataMessage="No hay consultas registradas para este paciente."
              />
            </Tabs.Panel>

            <Tabs.Panel id="certificates" className="py-4">
              <DataTable
                columns={certificateColumns}
                data={patient.medicalCertificates || []}
                noDataMessage="No se han emitido certificados a este paciente."
              />
            </Tabs.Panel>

            <Tabs.Panel id="info" className="py-4">
              <Card className="border-none bg-base-100 shadow-sm">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailRow label="Nombres" value={person.names} />
                    <DetailRow
                      label="Apellidos"
                      value={`${person.fatherName} ${person.motherName}`}
                    />
                    <DetailRow label="RUT" value={person.rut} />
                    <DetailRow
                      label="Fecha Nacimiento"
                      value={dayjs(patient.birthDate).format("DD [de] MMMM [de] YYYY")}
                    />
                    <DetailRow label="Email" value={person.email} />
                    <DetailRow label="Teléfono" value={person.phone} />
                    <div className="md:col-span-2">
                      <DetailRow label="Dirección" value={person.address} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-base-content/40 uppercase tracking-wider">
        {label}
      </span>
      <p className="text-base-content/90 font-medium">{value || "---"}</p>
    </div>
  );
}

const consultationColumns: ColumnDef<Consultation>[] = [
  {
    accessorKey: "date",
    header: "FECHA",
    cell: ({ row }) => dayjs(row.original.date).format("DD/MM/YYYY"),
  },
  {
    accessorKey: "reason",
    header: "MOTIVO",
    cell: ({ row }) => <span className="max-w-50 truncate block">{row.original.reason}</span>,
  },
  {
    accessorKey: "diagnosis",
    header: "DIAGNÓSTICO",
  },
  {
    id: "actions",
    header: "",
    cell: () => (
      <Button size="sm" variant="ghost" isIconOnly className="h-8 w-8 min-w-0">
        <ArrowRight size={16} />
      </Button>
    ),
  },
];

const certificateColumns: ColumnDef<MedicalCertificate>[] = [
  {
    accessorKey: "issuedAt",
    header: "EMISIÓN",
    cell: ({ row }) => dayjs(row.original.issuedAt).format("DD/MM/YYYY HH:mm"),
  },
  {
    accessorKey: "diagnosis",
    header: "DIAGNÓSTICO",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <a
        target="_blank"
        href={`${globalThis.location.origin}/verify/${row.original.id}`}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-medium hover:bg-base-200 transition-colors"
        rel="noreferrer"
      >
        <ExternalLink size={14} />
        Verificar
      </a>
    ),
  },
];

const ArrowRight = ({ size, className }: { size?: number; className?: string }) => (
  <svg
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
