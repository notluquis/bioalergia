import {
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import type {
  CompanyDto,
  CreateQuoteInput,
  QuoteDto,
  QuoteProductDto,
} from "@finanzas/orpc-contracts/quotes";
import { Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppDatePicker } from "@/components/forms/AppDatePicker";
import { CompanyFormModal } from "@/features/quotes/components/CompanyFormModal";
import { CompanyPicker } from "@/features/quotes/components/CompanyPicker";
import { ProductPicker } from "@/features/quotes/components/ProductPicker";
import { computeQuoteTotals } from "@/features/quotes/totals";
import { formatCurrency } from "@/lib/utils";

export type QuoteEditorPayload = Omit<CreateQuoteInput, "status">;

type LineDraft = {
  productId: number | null;
  code: string;
  brand: string;
  category: string;
  description: string;
  format: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  exempt: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoFrom(d: Date | string | null | undefined): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

function lineFromProduct(p: QuoteProductDto): LineDraft {
  return {
    productId: p.id,
    code: p.code ?? "",
    brand: p.brand ?? "",
    category: p.category ?? "",
    description: p.name,
    format: p.format ?? "",
    quantity: 1,
    unitPrice: p.unitPrice,
    discount: 0,
    exempt: false,
  };
}

type QuoteEditorProps = {
  initial?: QuoteDto;
  /** Empresa precargada (modo crear desde detalle de empresa). */
  presetCompany?: CompanyDto | null;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (payload: QuoteEditorPayload) => void;
};

export function QuoteEditor({
  initial,
  presetCompany,
  submitLabel,
  isPending,
  onSubmit,
}: QuoteEditorProps) {
  const [company, setCompany] = useState<CompanyDto | null>(
    initial?.company ?? presetCompany ?? null
  );
  const [contactId, setContactId] = useState<number | null>(initial?.contactId ?? null);
  const [issueDate, setIssueDate] = useState<string>(isoFrom(initial?.issueDate) || todayIso());
  const [dueDate, setDueDate] = useState<string>(isoFrom(initial?.dueDate));
  const [condicionPago, setCondicionPago] = useState(
    initial?.condicionPago ?? presetCompany?.condicionPago ?? ""
  );
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? 19);
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [comments, setComments] = useState(initial?.comments ?? "");
  const [lines, setLines] = useState<LineDraft[]>(
    initial?.items.map((it) => ({
      productId: it.productId,
      code: it.code ?? "",
      brand: it.brand ?? "",
      category: it.category ?? "",
      description: it.description,
      format: it.format ?? "",
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discount: it.discount,
      exempt: it.exempt,
    })) ?? []
  );
  const [companyModalOpen, setCompanyModalOpen] = useState(false);

  const totals = computeQuoteTotals(lines, discount, taxRate);
  const setLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const submit = () => {
    if (!company) return;
    onSubmit({
      companyId: company.id,
      contactId,
      issueDate: issueDate || undefined,
      dueDate: dueDate || null,
      condicionPago: condicionPago.trim() || null,
      taxRate,
      discount,
      comments: comments.trim() || null,
      items: lines.map((l) => ({
        productId: l.productId,
        code: l.code || null,
        brand: l.brand || null,
        category: l.category || null,
        description: l.description.trim(),
        format: l.format || null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        exempt: l.exempt,
      })),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Configuración ── */}
      <Card className="space-y-5 p-6">
        <h2 className="font-semibold text-lg">Datos de la cotización</h2>

        {/* Empresa */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Empresa cliente</Label>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onPress={() => setCompanyModalOpen(true)}
            >
              <Plus size={14} /> Nueva
            </Button>
          </div>
          {company ? (
            <div className="flex items-center justify-between rounded-lg border border-default-200 px-3 py-2">
              <div>
                <p className="font-medium text-sm">{company.razonSocial}</p>
                <p className="text-default-500 text-xs">
                  {[company.rut, company.giro].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onPress={() => {
                  setCompany(null);
                  setContactId(null);
                }}
              >
                Cambiar
              </Button>
            </div>
          ) : (
            <CompanyPicker
              onSelect={(c) => {
                setCompany(c);
                if (!condicionPago) setCondicionPago(c.condicionPago ?? "");
              }}
            />
          )}
        </div>

        {/* Contacto / solicitante */}
        {company && company.contacts.length > 0 ? (
          <div className="space-y-1">
            <Label>Contacto / solicitante</Label>
            <Select
              aria-label="Contacto"
              selectedKey={contactId == null ? "__none__" : String(contactId)}
              onSelectionChange={(k) => setContactId(k === "__none__" ? null : Number(k))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="__none__" key="__none__">
                    — Sin contacto —
                  </ListBox.Item>
                  {company.contacts.map((ct) => (
                    <ListBox.Item id={String(ct.id)} key={ct.id}>
                      {ct.name}
                      {ct.role ? ` · ${ct.role}` : ""}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <AppDatePicker label="Fecha de emisión" value={issueDate} onChange={setIssueDate} />
          <AppDatePicker label="Vencimiento (opcional)" value={dueDate} onChange={setDueDate} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField className="sm:col-span-1" value={condicionPago} onChange={setCondicionPago}>
            <Label>Condición de pago</Label>
            <Input placeholder="CRÉDITO 7 DÍAS" />
          </TextField>
          <NumberField
            variant="secondary"
            minValue={0}
            maxValue={100}
            value={taxRate}
            onChange={(v) => setTaxRate(v ?? 0)}
          >
            <Label>IVA (%)</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
          <NumberField
            variant="secondary"
            minValue={0}
            formatOptions={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }}
            value={discount}
            onChange={(v) => setDiscount(v ?? 0)}
          >
            <Label>Descuento global</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>
        </div>

        {/* Productos */}
        <div className="space-y-2">
          <Label>Agregar producto del catálogo</Label>
          <ProductPicker onSelect={(p) => setLines((ls) => [...ls, lineFromProduct(p)])} />
        </div>

        {lines.length > 0 ? (
          <div className="space-y-3">
            {lines.map((l, idx) => (
              <div key={idx} className="space-y-2 rounded-lg border border-default-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <TextField
                    className="flex-1"
                    value={l.description}
                    onChange={(v) => setLine(idx, { description: v })}
                  >
                    <Label className="text-xs">Detalle</Label>
                    <Input placeholder="Detalle del producto" />
                  </TextField>
                  <Button
                    variant="outline"
                    size="sm"
                    isIconOnly
                    className="mt-6 text-danger"
                    aria-label="Quitar línea"
                    onPress={() => setLines((ls) => ls.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <NumberField
                    variant="secondary"
                    minValue={0}
                    value={l.quantity}
                    onChange={(v) => setLine(idx, { quantity: v ?? 0 })}
                  >
                    <Label className="text-xs">Cantidad</Label>
                    <NumberField.Group className="grid-cols-1">
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                  <NumberField
                    variant="secondary"
                    minValue={0}
                    formatOptions={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }}
                    value={l.unitPrice}
                    onChange={(v) => setLine(idx, { unitPrice: v ?? 0 })}
                  >
                    <Label className="text-xs">P. Unitario</Label>
                    <NumberField.Group className="grid-cols-1">
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                  <NumberField
                    variant="secondary"
                    minValue={0}
                    formatOptions={{ style: "currency", currency: "CLP", maximumFractionDigits: 0 }}
                    value={l.discount}
                    onChange={(v) => setLine(idx, { discount: v ?? 0 })}
                  >
                    <Label className="text-xs">Desc. línea</Label>
                    <NumberField.Group className="grid-cols-1">
                      <NumberField.Input />
                    </NumberField.Group>
                  </NumberField>
                  <div className="flex items-center pt-6">
                    <Switch isSelected={l.exempt} onChange={(v) => setLine(idx, { exempt: v })}>
                      Exento
                    </Switch>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>Aún no hay líneas. Agrega productos del catálogo.</EmptyState>
        )}

        <TextField value={comments} onChange={setComments}>
          <Label>Comentarios</Label>
          <TextArea rows={3} placeholder="Notas que se imprimen en la cotización…" />
        </TextField>
      </Card>

      {/* ── Preview en vivo ── */}
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Vista previa</h2>
          <span className="rounded bg-default-100 px-2 py-0.5 text-default-500 text-xs">
            Cotización
          </span>
        </div>
        <p className="text-default-400 text-xs">
          Los datos del emisor (Bioalergia, RUT, dirección) se toman de la configuración de la
          clínica y se incluyen en el PDF.
        </p>

        {company ? (
          <div className="rounded-lg border border-default-200 p-3 text-sm">
            <p className="font-semibold">{company.razonSocial}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-default-500 text-xs">
              <span>RUT: {company.rut ?? "—"}</span>
              <span>Giro: {company.giro ?? "—"}</span>
              <span>Dirección: {company.direccion ?? "—"}</span>
              <span>Comuna: {company.comuna ?? "—"}</span>
              <span>Cond. pago: {condicionPago || company.condicionPago || "—"}</span>
              <span>
                Solicitante: {company.contacts.find((c) => c.id === contactId)?.name ?? "—"}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-default-500 text-sm">Selecciona una empresa para previsualizar.</p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-default-200 border-b text-left text-default-500">
              <th className="py-1">#</th>
              <th className="py-1">Detalle</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">P. Unit</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const sub = Math.max(0, l.quantity * l.unitPrice - l.discount);
              return (
                <tr key={idx} className="border-default-100 border-b align-top">
                  <td className="py-1.5">{idx + 1}</td>
                  <td className="py-1.5">
                    {l.description || "—"}
                    {l.format ? <span className="text-default-400"> · {l.format}</span> : null}
                    {l.exempt ? <span className="text-warning"> (exento)</span> : null}
                  </td>
                  <td className="py-1.5 text-right">{l.quantity}</td>
                  <td className="py-1.5 text-right">{formatCurrency(l.unitPrice)}</td>
                  <td className="py-1.5 text-right">{formatCurrency(sub)}</td>
                </tr>
              );
            })}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-center text-default-400">
                  Sin líneas
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="flex justify-between text-success">
              <span>Descuento</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>IVA {taxRate}%</span>
            <span>{formatCurrency(totals.taxAmount)}</span>
          </div>
          <div className="flex justify-between border-default-200 border-t pt-1 font-semibold text-base">
            <span>TOTAL</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            className="gap-2"
            isPending={isPending}
            isDisabled={!company || lines.length === 0}
            onPress={submit}
          >
            <Save size={18} /> {submitLabel}
          </Button>
        </div>
      </Card>

      <CompanyFormModal
        isOpen={companyModalOpen}
        onOpenChange={setCompanyModalOpen}
        onSaved={(c) => {
          setCompany(c);
          if (!condicionPago) setCondicionPago(c.condicionPago ?? "");
        }}
      />
    </div>
  );
}
