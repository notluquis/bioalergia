import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Label,
  ListBox,
  Modal,
  SearchField,
  Select,
  TextField,
} from "@heroui/react";
import type { ReactivoLeadDto, ReactivoLeadStatus } from "@finanzas/orpc-contracts/reactivos";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/lib/authz/route-guards";
import { Inbox } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { useSettings } from "@/features/settings/hooks/use-settings";
import { leadsKeys, listLeads, updateLeadStatus } from "@/features/reactivos-leads/api";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast-interceptor";
import { PAGE_CONTAINER } from "@/lib/styles";

const EMPTY: never[] = [];

const STATUS_LABEL: Record<ReactivoLeadStatus, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  COTIZADO: "Cotizado",
  CERRADO: "Cerrado",
};

const STATUS_COLOR: Record<ReactivoLeadStatus, "default" | "warning" | "success"> = {
  NUEVO: "warning",
  CONTACTADO: "default",
  COTIZADO: "default",
  CERRADO: "success",
};

const STATUS_OPTIONS: { id: ReactivoLeadStatus; label: string }[] = [
  { id: "NUEVO", label: "Nuevo" },
  { id: "CONTACTADO", label: "Contactado" },
  { id: "COTIZADO", label: "Cotizado" },
  { id: "CERRADO", label: "Cerrado" },
];

export const Route = createFileRoute("/_authed/settings/reactivos-leads")({
  staticData: {
    nav: {
      iconKey: "Inbox",
      label: "Leads reactivos",
      order: 89,
      section: "Sistema",
    },
    permission: { action: "read", subject: "ReactivoLead" },
    title: "Configuración — Leads de reactivos",
  },
  beforeLoad: requirePermission("read", "ReactivoLead"),
  component: ReactivosLeadsPage,
});

function ReactivosLeadsPage() {
  const leadsQuery = useQuery({ queryKey: leadsKeys.list(), queryFn: listLeads });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReactivoLeadDto | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);

  const leads = leadsQuery.data ?? EMPTY;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.empresa, l.contactName, l.email, l.phone, l.rut].some(
        (v) => v != null && v.toLowerCase().includes(q)
      )
    );
  }, [leads, search]);

  const openDetail = (lead: ReactivoLeadDto) => {
    setSelected(lead);
    setDetailOpen(true);
  };

  const columns = useMemo<ColumnDef<ReactivoLeadDto>[]>(
    () => [
      {
        accessorKey: "empresa",
        header: "Empresa",
        cell: ({ row }) => <span className="font-medium">{row.original.empresa}</span>,
      },
      { accessorKey: "contactName", header: "Contacto" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "phone", header: "Teléfono", cell: ({ row }) => row.original.phone ?? "—" },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
            {STATUS_LABEL[row.original.status]}
          </Chip>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Recibido",
        cell: ({ row }) => formatDateTime(row.original.createdAt),
      },
    ],
    []
  );

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-semibold text-xl">
            <Inbox size={22} /> Leads de reactivos
          </h1>
          <p className="text-default-500 text-sm">
            Solicitudes recibidas desde la vitrina pública /venta-empresas.
          </p>
        </div>
      </div>

      <LeadsEmailConfigCard />

      <Card className="space-y-4 p-4">
        <SearchField
          value={search}
          onChange={setSearch}
          aria-label="Buscar lead"
          variant="secondary"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Buscar por empresa, contacto, email o RUT…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        {!leadsQuery.isLoading && leads.length === 0 ? (
          <EmptyState>
            <div className="space-y-3 text-center">
              <p>Aún no hay leads de reactivos.</p>
            </div>
          </EmptyState>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={leadsQuery.isLoading}
            enableToolbar={false}
            enableVirtualization={false}
            noDataMessage="Sin resultados para la búsqueda."
            onRowClick={(l) => openDetail(l)}
          />
        )}
      </Card>

      <LeadDetailModal isOpen={detailOpen} onOpenChange={setDetailOpen} lead={selected} />
    </div>
  );
}

// Email destinatario de los avisos de leads (DB setting reactivos.leadsEmail).
function LeadsEmailConfigCard() {
  const { settings, updateSettings, canEdit } = useSettings();
  const [email, setEmail] = useState(settings.reactivoLeadsEmail);
  const [loadedFor, setLoadedFor] = useState(settings.reactivoLeadsEmail);
  if (settings.reactivoLeadsEmail !== loadedFor) {
    setEmail(settings.reactivoLeadsEmail);
    setLoadedFor(settings.reactivoLeadsEmail);
  }

  const saveMutation = useMutation({
    mutationFn: () => updateSettings({ ...settings, reactivoLeadsEmail: email.trim() }),
    onSuccess: () => toast.success("Email de avisos actualizado"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  if (!canEdit) return null;

  return (
    <Card className="mb-4 space-y-3 p-4">
      <div>
        <h2 className="font-medium text-sm">Email de avisos</h2>
        <p className="text-default-500 text-sm">
          Dirección que recibe cada nueva solicitud desde la vitrina pública.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <TextField className="min-w-64 flex-1" value={email} onChange={setEmail}>
          <Label>Destinatario</Label>
          <Input placeholder="contacto@bioalergia.cl" type="email" />
        </TextField>
        <Button
          isPending={saveMutation.isPending}
          isDisabled={!email.trim() || email.trim() === settings.reactivoLeadsEmail}
          onPress={() => saveMutation.mutate()}
        >
          Guardar
        </Button>
      </div>
    </Card>
  );
}

type LeadDetailModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: ReactivoLeadDto;
};

function LeadDetailModal({ isOpen, onOpenChange, lead }: LeadDetailModalProps) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: ReactivoLeadStatus) => {
      if (!lead) throw new Error("Sin lead");
      return updateLeadStatus({ id: lead.id, status });
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      void queryClient.invalidateQueries({ queryKey: leadsKeys.list() });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label="Detalle del lead">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{lead?.empresa ?? "Lead"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {lead ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Contacto" value={lead.contactName} />
                  <Field label="Email" value={lead.email} />
                  <Field label="Teléfono" value={lead.phone ?? "—"} />
                  <Field label="RUT" value={lead.rut ?? "—"} />
                  <Field label="Origen" value={lead.source} />
                </div>

                <div>
                  <p className="mb-1 font-medium text-default-700 text-sm">Mensaje</p>
                  <p className="whitespace-pre-wrap text-default-600 text-sm">
                    {lead.message?.trim() || "—"}
                  </p>
                </div>

                <div>
                  <p className="mb-2 font-medium text-default-700 text-sm">Productos de interés</p>
                  {lead.productsOfInterest.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {lead.productsOfInterest.map((p) => (
                        <Chip key={p} size="sm" variant="soft">
                          {p}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p className="text-default-500 text-sm">—</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="font-medium text-sm">Estado</Label>
                  <Select
                    aria-label="Estado del lead"
                    selectedKey={lead.status}
                    isDisabled={statusMutation.isPending}
                    onSelectionChange={(k) =>
                      statusMutation.mutate(String(k) as ReactivoLeadStatus)
                    }
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {STATUS_OPTIONS.map((opt) => (
                          <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                            {opt.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
              </div>
            ) : null}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-default-700 text-sm">{label}</p>
      <p className="text-default-600 text-sm">{value}</p>
    </div>
  );
}
