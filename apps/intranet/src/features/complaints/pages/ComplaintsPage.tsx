import {
  Button,
  Card,
  Chip,
  DateField,
  Input,
  Label,
  ListBox,
  Select,
  Tabs,
  TextField,
} from "@heroui/react";
import type {
  ComplaintChannel,
  ComplaintDto,
  ComplaintStatus,
  FoliatedBook,
  FoliatedBookEntryDto,
} from "@finanzas/orpc-contracts/complaints";
import { getLocalTimeZone, today } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { BookOpen, ClipboardList, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { complaintsORPCClient, toComplaintsApiError } from "@/features/complaints/orpc";
import { formatChile } from "@/lib/dates";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

const COMPLAINTS_KEY = ["complaints", "list"] as const;
const BOOK_KEY = (book: FoliatedBook) => ["complaints", "book", book] as const;

const CHANNEL_LABEL: Record<ComplaintChannel, string> = {
  PRESENCIAL: "Presencial",
  WEB: "Web",
  TELEFONO: "Teléfono",
  EMAIL: "Email",
  LIBRO: "Libro",
};

const STATUS_LABEL: Record<ComplaintStatus, string> = {
  RECEIVED: "Recibido",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelto",
  ESCALATED: "Escalado",
};

const STATUS_COLOR: Record<ComplaintStatus, "default" | "warning" | "success" | "danger"> = {
  RECEIVED: "warning",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  ESCALATED: "danger",
};

const BOOK_LABEL: Record<FoliatedBook, string> = {
  PROCEDURES: "Procedimientos",
  COMPLAINTS: "Reclamos",
  INSPECTIONS: "Inspecciones",
};

type ResolveStatus = "IN_PROGRESS" | "RESOLVED" | "ESCALATED";

const RESOLVE_OPTIONS: { id: ResolveStatus; label: string }[] = [
  { id: "IN_PROGRESS", label: "En curso" },
  { id: "RESOLVED", label: "Resuelto" },
  { id: "ESCALATED", label: "Escalado" },
];

const EMPTY_COMPLAINT = {
  channel: "PRESENCIAL" as ComplaintChannel,
  complainantName: "",
  complainantRut: "",
  contact: "",
  category: "",
  description: "",
};

function isOverdue(c: ComplaintDto): boolean {
  return c.status !== "RESOLVED" && new Date(c.dueAt).getTime() < Date.now();
}

// ── Sección Reclamos ───────────────────────────────────────────────────
function ComplaintsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: COMPLAINTS_KEY,
    queryFn: async () => {
      try {
        const res = await complaintsORPCClient.listComplaints({});
        return res.complaints;
      } catch (error) {
        throw toComplaintsApiError(error);
      }
    },
  });

  const [form, setForm] = useState({ ...EMPTY_COMPLAINT });
  const [resolveFor, setResolveFor] = useState<ComplaintDto | null>(null);
  const [resolveStatus, setResolveStatus] = useState<ResolveStatus>("RESOLVED");
  const [resolveText, setResolveText] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: COMPLAINTS_KEY });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.complainantName.trim()) throw new Error("Indica el nombre del reclamante");
      if (!form.description.trim()) throw new Error("Describe el reclamo");
      try {
        return await complaintsORPCClient.createComplaint({
          channel: form.channel,
          complainantName: form.complainantName.trim(),
          complainantRut: form.complainantRut.trim() || undefined,
          contact: form.contact.trim() || undefined,
          category: form.category.trim() || undefined,
          description: form.description.trim(),
        });
      } catch (error) {
        throw toComplaintsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Reclamo registrado");
      void invalidate();
      setForm({ ...EMPTY_COMPLAINT });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar"),
  });

  const resolve = useMutation({
    mutationFn: async () => {
      if (!resolveFor) throw new Error("Selecciona un reclamo");
      try {
        return await complaintsORPCClient.resolveComplaint({
          id: resolveFor.id,
          status: resolveStatus,
          resolution: resolveText.trim() || undefined,
        });
      } catch (error) {
        throw toComplaintsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Reclamo actualizado");
      void invalidate();
      setResolveFor(null);
      setResolveText("");
      setResolveStatus("RESOLVED");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const columns: ColumnDef<ComplaintDto>[] = [
    {
      header: "Canal",
      accessorKey: "channel",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft">
          {CHANNEL_LABEL[row.original.channel]}
        </Chip>
      ),
    },
    {
      header: "Reclamante",
      accessorKey: "complainantName",
      cell: ({ row }) => <span className="text-sm">{row.original.complainantName}</span>,
    },
    {
      header: "Estado",
      accessorKey: "status",
      cell: ({ row }) => (
        <Chip size="sm" variant="soft" color={STATUS_COLOR[row.original.status]}>
          {STATUS_LABEL[row.original.status]}
        </Chip>
      ),
    },
    {
      header: "Recibido",
      accessorKey: "receivedAt",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.receivedAt, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "Vence",
      accessorKey: "dueAt",
      cell: ({ row }) => (
        <span className={isOverdue(row.original) ? "font-semibold text-danger text-sm" : "text-sm"}>
          {formatChile(row.original.dueAt, "DD/MM/YYYY")}
          {isOverdue(row.original) ? " (vencida)" : ""}
        </span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex justify-end">
          {row.original.status !== "RESOLVED" && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                setResolveFor(row.original);
                setResolveStatus("RESOLVED");
                setResolveText(row.original.resolution ?? "");
              }}
            >
              Gestionar
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-base">Nuevo reclamo / sugerencia</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label className="font-medium text-sm">Canal</Label>
            <Select
              aria-label="Canal"
              selectedKey={form.channel}
              onSelectionChange={(k) =>
                setForm((f) => ({ ...f, channel: String(k) as ComplaintChannel }))
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(Object.keys(CHANNEL_LABEL) as ComplaintChannel[]).map((ch) => (
                    <ListBox.Item key={ch} id={ch} textValue={CHANNEL_LABEL[ch]}>
                      {CHANNEL_LABEL[ch]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <TextField
            value={form.complainantName}
            onChange={(v) => setForm((f) => ({ ...f, complainantName: v }))}
          >
            <Label>Nombre del reclamante</Label>
            <Input placeholder="Nombre y apellido" />
          </TextField>
          <TextField
            value={form.complainantRut}
            onChange={(v) => setForm((f) => ({ ...f, complainantRut: v }))}
          >
            <Label>RUT (opcional)</Label>
            <Input placeholder="12.345.678-9" />
          </TextField>
          <TextField value={form.contact} onChange={(v) => setForm((f) => ({ ...f, contact: v }))}>
            <Label>Contacto (opcional)</Label>
            <Input placeholder="Email o teléfono" />
          </TextField>
          <TextField
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          >
            <Label>Categoría (opcional)</Label>
            <Input placeholder="ej. Atención" />
          </TextField>
          <TextField
            className="lg:col-span-3"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          >
            <Label>Descripción</Label>
            <Input placeholder="Detalle del reclamo o sugerencia" />
          </TextField>
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
            <Plus size={16} aria-hidden="true" />
            Registrar
          </Button>
        </div>
      </Card>

      {resolveFor && (
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold text-base">
            Gestionar reclamo de {resolveFor.complainantName}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="font-medium text-sm">Nuevo estado</Label>
              <Select
                aria-label="Nuevo estado"
                selectedKey={resolveStatus}
                onSelectionChange={(k) => setResolveStatus(String(k) as ResolveStatus)}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {RESOLVE_OPTIONS.map((opt) => (
                      <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                        {opt.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <TextField value={resolveText} onChange={setResolveText}>
              <Label>Resolución (opcional)</Label>
              <Input placeholder="Respuesta o nota interna" />
            </TextField>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onPress={() => {
                setResolveFor(null);
                setResolveText("");
              }}
            >
              Cancelar
            </Button>
            <Button isPending={resolve.isPending} onPress={() => resolve.mutate()}>
              Guardar
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando reclamos" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin reclamos registrados."
        />
      )}
    </div>
  );
}

// ── Sección Libros foliados ────────────────────────────────────────────
function BookEntriesSection() {
  const queryClient = useQueryClient();
  const [book, setBook] = useState<FoliatedBook>("PROCEDURES");
  const [summary, setSummary] = useState("");
  const [refType, setRefType] = useState("");
  const [entryDate, setEntryDate] = useState<DateValue | null>(today(getLocalTimeZone()));

  const { data, isLoading } = useQuery({
    queryKey: BOOK_KEY(book),
    queryFn: async () => {
      try {
        const res = await complaintsORPCClient.listBookEntries({ book });
        return res.entries;
      } catch (error) {
        throw toComplaintsApiError(error);
      }
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!summary.trim()) throw new Error("Indica el resumen");
      if (!entryDate) throw new Error("Indica la fecha");
      try {
        return await complaintsORPCClient.createBookEntry({
          book,
          entryDate: entryDate.toString(),
          summary: summary.trim(),
          refType: refType.trim() || undefined,
        });
      } catch (error) {
        throw toComplaintsApiError(error);
      }
    },
    onSuccess: () => {
      toast.success("Entrada agregada al libro");
      void queryClient.invalidateQueries({ queryKey: BOOK_KEY(book) });
      setSummary("");
      setRefType("");
      setEntryDate(today(getLocalTimeZone()));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo agregar"),
  });

  const columns: ColumnDef<FoliatedBookEntryDto>[] = [
    {
      header: "Folio",
      accessorKey: "folio",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.folio}</span>,
    },
    {
      header: "Fecha",
      accessorKey: "entryDate",
      cell: ({ row }) => (
        <span className="text-sm">{formatChile(row.original.entryDate, "DD/MM/YYYY")}</span>
      ),
    },
    {
      header: "Resumen",
      accessorKey: "summary",
      cell: ({ row }) => <span className="text-sm">{row.original.summary}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-base">Nueva entrada de libro</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="font-medium text-sm">Libro</Label>
            <Select
              aria-label="Libro"
              selectedKey={book}
              onSelectionChange={(k) => setBook(String(k) as FoliatedBook)}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {(Object.keys(BOOK_LABEL) as FoliatedBook[]).map((b) => (
                    <ListBox.Item key={b} id={b} textValue={BOOK_LABEL[b]}>
                      {BOOK_LABEL[b]}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <DateField value={entryDate} onChange={setEntryDate}>
            <Label>Fecha de entrada</Label>
            <DateField.Group>
              <DateField.Input>
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.Group>
          </DateField>
          <TextField value={refType} onChange={setRefType}>
            <Label>Referencia (opcional)</Label>
            <Input placeholder="ej. Acta N°" />
          </TextField>
          <TextField className="lg:col-span-4" value={summary} onChange={setSummary}>
            <Label>Resumen</Label>
            <Input placeholder="Resumen de la entrada" />
          </TextField>
        </div>
        <div className="flex justify-end">
          <Button className="gap-2" isPending={create.isPending} onPress={() => create.mutate()}>
            <Plus size={16} aria-hidden="true" />
            Agregar al libro {BOOK_LABEL[book]}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner label="Cargando libro" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data ?? []}
          enablePagination={false}
          enableToolbar={false}
          noDataMessage="Sin entradas en este libro."
        />
      )}
    </div>
  );
}

export function ComplaintsPage() {
  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardList size={22} aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-bold text-foreground text-xl tracking-tight">Reclamos y libros</h1>
          <p className="text-default-500 text-sm">
            Reclamos y sugerencias (Decreto 35: acuse y respuesta en 15 días hábiles) y libros
            foliados electrónicos.
          </p>
        </div>
      </div>

      <Tabs defaultSelectedKey="complaints">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de cumplimiento">
            <Tabs.Tab id="complaints">
              <ClipboardList size={16} aria-hidden="true" className="mr-1.5" />
              Reclamos
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="books">
              <Tabs.Separator />
              <BookOpen size={16} aria-hidden="true" className="mr-1.5" />
              Libros foliados
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel className="pt-6" id="complaints">
          <ComplaintsSection />
        </Tabs.Panel>
        <Tabs.Panel className="pt-6" id="books">
          <BookEntriesSection />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
