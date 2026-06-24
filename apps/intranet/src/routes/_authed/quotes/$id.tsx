import { Button, Card, EmptyState, ListBox, Select, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Download, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  deleteQuote,
  downloadQuotePdf,
  getQuote,
  quotesKeys,
  updateQuote,
} from "@/features/quotes/api";
import { QuoteEditor, type QuoteEditorPayload } from "@/features/quotes/components/QuoteEditor";
import { STATUS_OPTIONS } from "@/features/quotes/labels";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import { PAGE_CONTAINER } from "@/lib/styles";
import { toast } from "@/lib/toast-interceptor";

export const Route = createFileRoute("/_authed/quotes/$id")({
  staticData: {
    permission: { action: "read", subject: "Quote" },
    title: "Cotización",
    hideFromNav: true,
  },
  component: QuoteDetailPage,
});

function formatDate(d: Date | string): string {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(new Date(d));
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-default-500 text-xs">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

function QuoteDetailPage() {
  const { id } = Route.useParams();
  const quoteId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  const quoteQuery = useQuery({
    queryKey: quotesKeys.detail(quoteId),
    queryFn: () => getQuote(quoteId),
  });
  const quote = quoteQuery.data;

  const editMutation = useMutation({
    mutationFn: (payload: QuoteEditorPayload) => updateQuote({ id: quoteId, ...payload }),
    onSuccess: () => {
      toast.success("Cotización actualizada");
      void queryClient.invalidateQueries({ queryKey: quotesKeys.detail(quoteId) });
      void queryClient.invalidateQueries({ queryKey: quotesKeys.all });
      setIsEditing(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const statusMutation = useMutation({
    mutationFn: (status: (typeof STATUS_OPTIONS)[number]["id"]) =>
      updateQuote({ id: quoteId, status }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      void queryClient.invalidateQueries({ queryKey: quotesKeys.detail(quoteId) });
      void queryClient.invalidateQueries({ queryKey: quotesKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const pdfMutation = useMutation({
    mutationFn: () => {
      if (!quote) throw new Error("Cotización no cargada");
      return downloadQuotePdf(quote.id, quote.folio);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuote(quoteId),
    onSuccess: () => {
      toast.success("Cotización eliminada");
      void queryClient.invalidateQueries({ queryKey: quotesKeys.all });
      void navigate({ to: "/quotes" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  if (quoteQuery.isLoading) {
    return (
      <div className={PAGE_CONTAINER}>
        <Spinner aria-label="Cargando cotización" />
      </div>
    );
  }
  if (!quote) {
    return (
      <div className={PAGE_CONTAINER}>
        <EmptyState>Cotización no encontrada.</EmptyState>
      </div>
    );
  }

  const company = quote.company;

  return (
    <div className={PAGE_CONTAINER}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onPress={() => void navigate({ to: "/quotes" })}
        >
          <ChevronLeft size={20} /> Volver
        </Button>
        {isEditing ? (
          <Button variant="outline" className="gap-2" onPress={() => setIsEditing(false)}>
            <X size={18} /> Cancelar edición
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Estado"
              selectedKey={quote.status}
              onSelectionChange={(k) =>
                statusMutation.mutate(k as (typeof STATUS_OPTIONS)[number]["id"])
              }
            >
              <Select.Trigger className="min-w-36">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {STATUS_OPTIONS.map((s) => (
                    <ListBox.Item id={s.id} key={s.id}>
                      {s.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button variant="outline" className="gap-2" onPress={() => setIsEditing(true)}>
              <Pencil size={18} /> Editar
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              isPending={pdfMutation.isPending}
              onPress={() => pdfMutation.mutate()}
            >
              <Download size={18} /> PDF
            </Button>
            <Button
              variant="outline"
              className="gap-2 text-danger"
              onPress={async () => {
                const ok = await confirmAction({
                  title: "Eliminar cotización",
                  description: `¿Eliminar la cotización N° ${quote.folio}?`,
                  variant: "danger",
                });
                if (ok) deleteMutation.mutate();
              }}
            >
              <Trash2 size={18} /> Eliminar
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <QuoteEditor
          initial={quote}
          submitLabel="Guardar cambios"
          isPending={editMutation.isPending}
          onSubmit={(payload) => editMutation.mutate(payload)}
        />
      ) : (
        <Card className="space-y-6 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-semibold text-2xl">Cotización</h1>
              <p className="text-default-500">Folio N° {String(quote.folio).padStart(4, "0")}</p>
            </div>
            <div className="text-right text-sm">
              <p>{formatDate(quote.issueDate)}</p>
              {quote.createdByName ? (
                <p className="text-default-500">Vendedor: {quote.createdByName}</p>
              ) : null}
            </div>
          </div>

          {/* Cliente */}
          <div className="rounded-lg border border-default-200 p-4">
            <p className="font-semibold">{company.razonSocial}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <Field label="RUT" value={company.rut} />
              <Field label="Giro" value={company.giro} />
              <Field
                label="Condición de pago"
                value={quote.condicionPago ?? company.condicionPago}
              />
              <Field label="Dirección" value={company.direccion} />
              <Field label="Comuna" value={company.comuna} />
              <Field label="Contacto / Solicitante" value={quote.contact?.name} />
            </div>
          </div>

          {/* Líneas */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-default-200 border-b text-left text-default-500">
                <th className="py-2">#</th>
                <th className="py-2">Código</th>
                <th className="py-2">Detalle</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">P. Unit</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it, idx) => (
                <tr key={it.id} className="border-default-100 border-b align-top">
                  <td className="py-2">{idx + 1}</td>
                  <td className="py-2">{it.code ?? "—"}</td>
                  <td className="py-2">
                    {it.description}
                    {it.format ? <span className="text-default-400"> · {it.format}</span> : null}
                    {it.brand || it.category ? (
                      <span className="block text-default-400 text-xs">
                        {[it.brand, it.category].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                    {it.exempt ? <span className="text-warning"> (exento)</span> : null}
                  </td>
                  <td className="py-2 text-right">{it.quantity}</td>
                  <td className="py-2 text-right">{formatCurrency(it.unitPrice)}</td>
                  <td className="py-2 text-right">{formatCurrency(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
            {quote.comments ? (
              <div className="flex-1">
                <p className="font-medium text-sm">Comentarios</p>
                <p className="whitespace-pre-wrap text-default-600 text-sm">{quote.comments}</p>
              </div>
            ) : (
              <div className="flex-1" />
            )}
            <div className="w-full space-y-1 text-sm sm:w-64">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount > 0 ? (
                <div className="flex justify-between text-success">
                  <span>Descuento</span>
                  <span>- {formatCurrency(quote.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span>IVA {quote.taxRate}%</span>
                <span>{formatCurrency(quote.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-default-200 border-t pt-1 font-semibold text-base">
                <span>TOTAL</span>
                <span>{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
