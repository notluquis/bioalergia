import { Card } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowRight, Calendar, Search, User, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import Button from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/api-client";
import { PAGE_CONTAINER_RELAXED, TITLE_LG } from "@/lib/styles";

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
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

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
                <span className="font-medium text-foreground">
                  {patient.person.names} {patient.person.fatherName} {patient.person.motherName}
                </span>
                <span className="text-xs text-default-500">
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
          <span className="text-default-700 font-mono">{row.original.person.rut}</span>
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
              <span className="text-default-700 text-sm">{age} años</span>
              <span className="text-[10px] text-default-400">
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
          <div className="flex items-center gap-2 text-default-500">
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
    <section className={PAGE_CONTAINER_RELAXED}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className={TITLE_LG}>Pacientes</h1>
          <p className="text-default-500 text-sm">Gestión de ficha clínica y certificados</p>
        </div>
        <Link to="/patients/new">
          <Button variant="primary" className="shadow-md w-full sm:w-auto">
            <UserPlus size={18} className="mr-2" />
            Registrar Paciente
          </Button>
        </Link>
      </div>

      <Card className="border-none bg-background shadow-sm">
        <CardContent className="p-4">
          <Input
            placeholder="Buscar por nombre o RUT..."
            rightElement={<Search size={18} className="text-default-300" />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
            }}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={patients || []}
        containerVariant="plain"
        enableExport={false}
        enableGlobalFilter={false}
        enableToolbar={false}
        isLoading={isLoading}
        onPaginationChange={setPagination}
        pageSizeOptions={[10, 20, 50]}
        pagination={pagination}
        noDataMessage="No se encontraron pacientes registrados."
      />
    </section>
  );
}
