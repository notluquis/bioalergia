import { Button, Card, Chip, SearchField, Tabs } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { ArrowRight, Database, RefreshCw, User, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { TableRegion } from "@/components/data-table/TableRegion";
import {
  fetchPatientDteSources,
  fetchPatients,
  syncPatientDteSources,
} from "@/features/patients/api";
import { CreatePatientModal } from "@/features/patients/components/CreatePatientModal";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useLazyTabs } from "@/hooks/use-lazy-tabs";
import { PAGE_CONTAINER_RELAXED } from "@/lib/styles";

export const Route = createFileRoute("/_authed/patients/")({
  staticData: {
    nav: { iconKey: "Users", label: "Pacientes", order: 10, section: "Pacientes" },
    permission: { action: "read", subject: "Patient" },
    relatedSubjects: ["Person", "Consultation", "Passkey"],
  },
  component: PatientsListPage,
});

type Patient = Awaited<ReturnType<typeof fetchPatients>>[number];
type DtePatientSource = Awaited<ReturnType<typeof fetchPatientDteSources>>[number];

function PatientsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { close: closeCreateModal, isOpen: createOpen, open: openCreateModal } = useDisclosure();
  const [searchClinical, setSearchClinical] = useState("");
  const [searchDte, setSearchDte] = useState("");
  const [activeTab, setActiveTab] = useState<"clinical" | "dte">("clinical");
  const { isTabMounted, markTabAsMounted } = useLazyTabs<"clinical" | "dte">("clinical");
  const [paginationClinical, setPaginationClinical] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [paginationDte, setPaginationDte] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ["patients", searchClinical],
    queryFn: async () => fetchPatients(searchClinical),
  });

  const { data: dteSources = [], isLoading: isLoadingDteSources } = useQuery({
    queryKey: ["patients", "dte-sources", searchDte],
    queryFn: async () => fetchPatientDteSources({ limit: 300, q: searchDte }),
  });

  const syncDteSourcesMutation = useMutation({
    mutationFn: async () => syncPatientDteSources({ dryRun: false }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", "dte-sources"] }),
  });

  const patientColumns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: "person.names",
        header: "PACIENTE",
        cell: ({ row }) => {
          const patient = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User size={16} />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">
                  {patient.person.names} {patient.person.fatherName} {patient.person.motherName}
                </span>
                <span className="text-default-500 text-xs">
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
          <span className="font-mono text-default-700">{row.original.person.rut}</span>
        ),
      },
      {
        accessorKey: "birthDate",
        header: "EDAD",
        cell: ({ row }) => {
          const { birthDate } = row.original;
          if (!birthDate) {
            return <span className="text-default-400 text-sm">Sin fecha</span>;
          }
          const age = dayjs().diff(dayjs(birthDate, "YYYY-MM-DD"), "year");
          return (
            <div className="flex flex-col">
              <span className="text-default-700 text-sm">{age} años</span>
              <span className="text-[10px] text-default-400">
                {dayjs(birthDate, "YYYY-MM-DD").format("DD/MM/YYYY")}
              </span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "ACCIONES",
        cell: ({ row }) => (
          <Button
            className="h-8 w-8 min-w-0 p-0"
            onPress={() =>
              void navigate({
                params: { id: String(row.original.id) },
                to: "/patients/$id",
              })
            }
            size="sm"
            variant="outline"
          >
            <ArrowRight size={16} />
          </Button>
        ),
      },
    ],
    [navigate]
  );

  const dteColumns = useMemo<ColumnDef<DtePatientSource>[]>(
    () => [
      {
        accessorKey: "clientName",
        header: "CLIENTE (DTE)",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.clientName}</span>
            <span className="font-mono text-default-500 text-xs">{row.original.clientRUT}</span>
          </div>
        ),
      },
      {
        accessorKey: "documentType",
        header: "DOC",
        cell: ({ row }) => <Chip size="sm">{row.original.documentType}</Chip>,
      },
      {
        accessorKey: "folio",
        header: "FOLIO",
        cell: ({ row }) => row.original.folio || "-",
      },
      {
        accessorKey: "period",
        header: "PERIODO",
        cell: ({ row }) => row.original.period || "-",
      },
      {
        accessorKey: "documentDate",
        header: "FECHA DOC",
        cell: ({ row }) => {
          const date = row.original.documentDate;
          return date ? dayjs(date).format("DD/MM/YYYY") : "-";
        },
      },
    ],
    []
  );

  return (
    <section className={PAGE_CONTAINER_RELAXED}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-default-600 text-sm">
          <Database size={16} />
          <span>
            {patients.length} fichas clínicas
            {" · "}
            {dteSources.length} registros fuente DTE
          </span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            className="w-full sm:w-auto"
            isPending={syncDteSourcesMutation.isPending}
            onPress={() => syncDteSourcesMutation.mutate()}
            variant="secondary"
          >
            <RefreshCw className="mr-2" size={16} />
            Sincronizar fuente DTE
          </Button>
          <Button className="w-full sm:w-auto" onPress={openCreateModal} variant="primary">
            <UserPlus className="mr-2" size={18} />
            Registrar paciente
          </Button>
        </div>
      </div>

      <Card className="border-none bg-background shadow-sm">
        <Card.Content className="p-4">
          <Tabs
            aria-label="Fuentes de pacientes"
            selectedKey={activeTab}
            onSelectionChange={(key) => {
              const nextTab = String(key) === "dte" ? "dte" : "clinical";
              setActiveTab(nextTab);
              markTabAsMounted(nextTab);
            }}
          >
            <Tabs.ListContainer className="muted-scrollbar overflow-x-auto pb-1">
              <Tabs.List
                aria-label="Secciones de paciente"
                className="w-max min-w-full rounded-xl bg-default-100 p-1 whitespace-nowrap"
              >
                <Tabs.Tab id="clinical">
                  Ficha clínica
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="dte">
                  Fuentes DTE
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel className="space-y-4 pt-4" id="clinical">
              {isTabMounted("clinical") ? (
                <>
                  <SearchField
                    className="max-w-md"
                    value={searchClinical}
                    onChange={(v) => {
                      setSearchClinical(v);
                      setPaginationClinical((prev) => ({ ...prev, pageIndex: 0 }));
                    }}
                    variant="secondary"
                  >
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Buscar ficha clínica por nombre o RUT..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <TableRegion>
                    <DataTable
                      columns={patientColumns}
                      containerVariant="plain"
                      data={patients}
                      enableExport={false}
                      enableGlobalFilter={false}
                      enableToolbar={false}
                      isLoading={isLoadingPatients}
                      noDataMessage="No hay fichas clínicas registradas."
                      onPaginationChange={setPaginationClinical}
                      pageSizeOptions={[10, 20, 50]}
                      pagination={paginationClinical}
                      scrollMaxHeight="var(--table-region-height)"
                    />
                  </TableRegion>
                </>
              ) : null}
            </Tabs.Panel>

            <Tabs.Panel className="space-y-4 pt-4" id="dte">
              {isTabMounted("dte") ? (
                <>
                  <SearchField
                    className="max-w-md"
                    value={searchDte}
                    onChange={(v) => {
                      setSearchDte(v);
                      setPaginationDte((prev) => ({ ...prev, pageIndex: 0 }));
                    }}
                    variant="secondary"
                  >
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder="Buscar en fuente DTE por nombre o RUT..." />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <TableRegion>
                    <DataTable
                      columns={dteColumns}
                      containerVariant="plain"
                      data={dteSources}
                      enableExport={false}
                      enableGlobalFilter={false}
                      enableToolbar={false}
                      isLoading={isLoadingDteSources}
                      noDataMessage="No hay registros DTE en la base de fuentes."
                      onPaginationChange={setPaginationDte}
                      pageSizeOptions={[10, 20, 50]}
                      pagination={paginationDte}
                      scrollMaxHeight="var(--table-region-height)"
                    />
                  </TableRegion>
                </>
              ) : null}
            </Tabs.Panel>
          </Tabs>
        </Card.Content>
      </Card>

      {createOpen ? <CreatePatientModal isOpen={createOpen} onClose={closeCreateModal} /> : null}
    </section>
  );
}
