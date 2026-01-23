import { Card } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowRight, Calendar, Search, User, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/_authed/patients/")({
  staticData: {
    nav: { iconKey: "Users", label: "Pacientes", order: 1, section: "Servicios" },
    permission: { action: "read", subject: "Patient" },
  },
  component: PatientsListPage,
});

// Types for the patient data
interface Patient {
  id: number;
  personId: number;
  birthDate: string;
  bloodType?: string;
  notes?: string;
  person: {
    rut: string;
    names: string;
    fatherName?: string;
    motherName?: string;
    email?: string;
    phone?: string;
  };
}

function PatientsListPage() {
  const [search, setSearch] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: async () => {
      return await apiClient.get<Patient[]>(`/api/patients?q=${encodeURIComponent(search)}`);
    },
  });

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: "person.names",
        header: "PACIENTE",
        cell: ({ row }) => {
          const patient = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-base-content">
                  {patient.person.names} {patient.person.fatherName} {patient.person.motherName}
                </span>
                <span className="text-xs text-base-content/60">
                  {patient.person.email || "Sin email"}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "person.rut",
        header: "RUT",
        cell: ({ row }) => (
          <span className="text-base-content/80 font-mono">{row.original.person.rut}</span>
        ),
      },
      {
        accessorKey: "birthDate",
        header: "EDAD",
        cell: ({ row }) => {
          const patient = row.original;
          const age = dayjs().diff(dayjs(patient.birthDate), "year");
          return (
            <div className="flex flex-col">
              <span className="text-base-content/80 text-sm">{age} años</span>
              <span className="text-[10px] text-base-content/50">
                {dayjs(patient.birthDate).format("DD/MM/YYYY")}
              </span>
            </div>
          );
        },
      },
      {
        id: "last_consultation",
        header: "ÚLT. CONSULTA",
        cell: () => (
          <div className="flex items-center gap-2 text-base-content/60">
            <Calendar size={14} />
            <span className="text-sm italic">Sin registros</span>
          </div>
        ),
      },
      {
        id: "actions",
        header: "ACCIONES",
        cell: ({ row }) => (
          <Button
            as={Link}
            // @ts-expect-error - Link to prop mismatch in HeroUI adapter wrap
            to={`/patients/${row.original.id}`}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 min-w-0"
          >
            <ArrowRight size={16} />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content">Pacientes</h1>
          <p className="text-base-content/60 text-sm">Gestión de ficha clínica y certificados</p>
        </div>
        <Link to="/patients/new">
          <Button variant="primary" className="shadow-md">
            <UserPlus size={18} className="mr-2" />
            Registrar Paciente
          </Button>
        </Link>
      </div>

      <Card className="border-none bg-base-100 shadow-sm">
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por nombre o RUT..."
            rightElement={<Search size={18} className="text-base-content/40" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={patients || []}
        isLoading={isLoading}
        noDataMessage="No se encontraron pacientes registrados."
      />
    </div>
  );
}
