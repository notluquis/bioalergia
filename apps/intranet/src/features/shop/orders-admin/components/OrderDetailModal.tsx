import { Button, Chip, Form, Input, Label, Modal, Spinner, TextField } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { formatCurrency } from "@/lib/utils";
import { updateOrderShippingAddress } from "../api";
import { orderKeys } from "../queries";
import type { OrderDetail, OrderStatus } from "../types";

/** Address is only editable before the order leaves for the courier. */
const EDITABLE_ADDRESS_STATUSES: ReadonlySet<OrderStatus> = new Set(["PENDING", "PAID"]);

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FULFILLED: "Despachado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const STATUS_COLOR: Record<OrderStatus, "success" | "warning" | "danger" | "accent" | "default"> = {
  PENDING: "warning",
  PAID: "accent",
  FULFILLED: "success",
  DELIVERED: "success",
  CANCELLED: "danger",
  REFUNDED: "default",
};

interface OrderDetailModalProps {
  readonly orderId: number | null;
  readonly onClose: () => void;
}

/** Best-effort render of the Chilexpress address JSON (or `null` for pickup). */
function ShippingAddress({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-default-500 text-sm">Retiro en tienda / sin dirección</span>;
  }
  if (typeof value === "object") {
    const addr = value as Record<string, unknown>;
    const str = (k: string): string =>
      typeof addr[k] === "string" && (addr[k] as string).length > 0 ? (addr[k] as string) : "";
    const streetLine = [str("street"), str("street_number")].filter(Boolean).join(" ");
    const parts = [streetLine, str("city"), str("region")].filter((p) => p.length > 0);
    if (parts.length > 0) {
      return <span className="text-foreground text-sm">{parts.join(", ")}</span>;
    }
  }
  return <span className="text-default-500 text-sm">Dirección registrada</span>;
}

/**
 * Operator downloads for a fulfilled order: the emitted DTE PDF (hosted URL) and
 * the Chilexpress thermal label (base64 → data-URL anchor download). Both are
 * rendered only when present.
 */
function OrderDownloads({ order }: { order: OrderDetail }) {
  if (!order.dte_pdf_url && !order.cx_label_base64) return null;
  return (
    <section className="flex flex-wrap gap-3">
      {order.dte_pdf_url ? (
        <a
          className="inline-flex items-center rounded-lg border border-default-200 px-3 py-1.5 font-medium text-primary text-sm hover:bg-default-50"
          href={order.dte_pdf_url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Descargar boleta/factura
        </a>
      ) : null}
      {order.cx_label_base64 ? (
        <a
          className="inline-flex items-center rounded-lg border border-default-200 px-3 py-1.5 font-medium text-primary text-sm hover:bg-default-50"
          download={`etiqueta-${order.number}.png`}
          href={`data:image/png;base64,${order.cx_label_base64}`}
        >
          Descargar etiqueta Chilexpress
        </a>
      ) : null}
    </section>
  );
}

function DetailBody({ order }: { order: OrderDetail }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip color={STATUS_COLOR[order.status]} size="sm" variant="soft">
          {STATUS_LABEL[order.status]}
        </Chip>
        <Chip size="sm" variant="secondary">
          {order.billing_type === "BOLETA" ? "Boleta" : "Factura"}
        </Chip>
        {order.dte_folio ? (
          <Chip size="sm" variant="soft">
            {(order.dte_type ?? "DTE") + " · " + order.dte_folio}
          </Chip>
        ) : null}
        {order.cx_ot_number ? (
          <Chip color="accent" size="sm" variant="soft">
            {"OT Chilexpress · " + order.cx_ot_number}
          </Chip>
        ) : null}
      </div>

      <section className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <Field label="Cliente" value={order.customer_name} />
        <Field label="Correo" value={order.customer_email} />
        <Field label="RUT" value={order.customer_rut ?? "—"} mono />
        <Field label="Teléfono" value={order.customer_phone ?? "—"} mono />
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-default-600 text-sm">Productos</h3>
        <div className="overflow-hidden rounded-xl border border-default-200">
          <table className="w-full text-sm">
            <thead className="bg-default-50 text-default-500 text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Producto</th>
                <th className="px-3 py-2 text-right font-medium">Cant.</th>
                <th className="px-3 py-2 text-right font-medium">Unitario</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr className="border-default-100 border-t" key={item.id}>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-foreground">{item.product_name}</span>
                      <span className="font-mono text-default-400 text-xs">{item.product_sku}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.qty}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(item.unit_price_clp)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(item.line_total_clp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="ml-auto flex w-full max-w-xs flex-col gap-1 text-sm">
        <Totals label="Subtotal" value={order.subtotal_clp} />
        <Totals label="Despacho" value={order.shipping_clp} />
        <div className="mt-1 flex items-center justify-between border-default-200 border-t pt-2 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(order.total_clp)}</span>
        </div>
      </section>

      <ShippingSection order={order} />

      <OrderDownloads order={order} />

      {order.notes ? (
        <section className="flex flex-col gap-1">
          <span className="font-semibold text-default-600 text-sm">Notas</span>
          <span className="text-foreground text-sm">{order.notes}</span>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col py-1">
      <span className="text-default-400 text-xs">{label}</span>
      <span className={mono ? "font-mono text-foreground text-sm" : "text-foreground text-sm"}>
        {value}
      </span>
    </div>
  );
}

function Totals({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-default-600">
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}

/** Read a string field off the stored shipping-address JSON (or ""). */
function readAddrField(value: unknown, key: string): string {
  if (value != null && typeof value === "object") {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string") return v;
  }
  return "";
}

/**
 * Shipping address block. For PENDING/PAID orders an operator with update rights
 * can correct typos inline. If the Chilexpress OT already exists (`cx_ot_number`)
 * we surface a warning: editing the stored address here does NOT recreate the OT.
 */
function ShippingSection({ order }: { order: OrderDetail }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { error: toastError, success } = useToast();
  const canEdit = can("update", "ShopOrder") && EDITABLE_ADDRESS_STATUSES.has(order.status);

  const [isEditing, setEditing] = useState(false);
  const [street, setStreet] = useState(() => readAddrField(order.shipping_address, "street"));
  const [streetNumber, setStreetNumber] = useState(() =>
    readAddrField(order.shipping_address, "street_number")
  );
  const [city, setCity] = useState(() => readAddrField(order.shipping_address, "city"));
  const [region, setRegion] = useState(() => readAddrField(order.shipping_address, "region"));
  const [countyCode, setCountyCode] = useState(() =>
    readAddrField(order.shipping_address, "county_code")
  );

  const mutation = useMutation({
    mutationFn: () =>
      updateOrderShippingAddress(order.id, {
        street: street.trim(),
        street_number: streetNumber.trim() || undefined,
        city: city.trim(),
        region: region.trim(),
        county_code: countyCode.trim() || undefined,
      }),
    onError: (e) => {
      toastError(e instanceof Error ? e.message : "No se pudo actualizar la dirección");
    },
    onSuccess: (updated) => {
      success(`Pedido ${updated.number}: dirección actualizada`);
      void queryClient.invalidateQueries({ queryKey: orderKeys.all });
      setEditing(false);
    },
  });

  function startEdit() {
    setStreet(readAddrField(order.shipping_address, "street"));
    setStreetNumber(readAddrField(order.shipping_address, "street_number"));
    setCity(readAddrField(order.shipping_address, "city"));
    setRegion(readAddrField(order.shipping_address, "region"));
    setCountyCode(readAddrField(order.shipping_address, "county_code"));
    setEditing(true);
  }

  function handleSubmit() {
    void (async () => {
      const ok = await confirmAction({
        title: "Editar dirección de despacho",
        description: order.cx_ot_number
          ? "El envío ya tiene OT creada; corregir la dirección aquí no la recrea — coordina con Chilexpress."
          : "Se corregirá la dirección guardada del pedido. Úsalo solo para corregir errores antes del despacho.",
        confirmLabel: "Guardar dirección",
        cancelLabel: "Volver",
      });
      if (ok) mutation.mutate();
    })();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-default-600 text-sm">Dirección de despacho</span>
        {canEdit && !isEditing ? (
          <Button onPress={startEdit} size="sm" variant="secondary">
            Editar dirección
          </Button>
        ) : null}
      </div>

      {order.cx_ot_number ? (
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />
          <span>
            El envío ya tiene OT creada ({order.cx_ot_number}); corregir la dirección aquí no la
            recrea — coordina con Chilexpress.
          </span>
        </div>
      ) : null}

      {isEditing ? (
        <Form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          validationBehavior="aria"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField isRequired onChange={setStreet} value={street}>
              <Label>Calle</Label>
              <Input placeholder="Calle" />
            </TextField>
            <TextField onChange={setStreetNumber} value={streetNumber}>
              <Label>Número</Label>
              <Input placeholder="Número" />
            </TextField>
            <TextField isRequired onChange={setCity} value={city}>
              <Label>Comuna</Label>
              <Input placeholder="Comuna" />
            </TextField>
            <TextField isRequired onChange={setRegion} value={region}>
              <Label>Región</Label>
              <Input placeholder="Región" />
            </TextField>
            <TextField className="sm:col-span-2" onChange={setCountyCode} value={countyCode}>
              <Label>Código de comuna (Chilexpress)</Label>
              <Input placeholder="Opcional — requerido para la OT" />
            </TextField>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              isDisabled={mutation.isPending}
              onPress={() => setEditing(false)}
              size="sm"
              variant="tertiary"
            >
              Cancelar
            </Button>
            <Button isPending={mutation.isPending} size="sm" type="submit" variant="primary">
              Guardar dirección
            </Button>
          </div>
        </Form>
      ) : (
        <ShippingAddress value={order.shipping_address} />
      )}
    </section>
  );
}

export function OrderDetailModal({ orderId, onClose }: OrderDetailModalProps) {
  const isOpen = orderId != null;
  const detailQuery = useQuery({
    ...orderKeys.detail(orderId ?? 0),
    enabled: isOpen,
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
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                {detailQuery.data ? `Pedido ${detailQuery.data.number}` : "Detalle del pedido"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="max-h-[70dvh] gap-4 overflow-y-auto">
              {detailQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-default-400 text-sm">
                  <Spinner size="sm" />
                  Cargando pedido…
                </div>
              ) : detailQuery.isError ? (
                <ErrorAlert
                  message={
                    detailQuery.error instanceof Error
                      ? detailQuery.error.message
                      : "No se pudo cargar el pedido"
                  }
                />
              ) : detailQuery.data ? (
                <DetailBody order={detailQuery.data} />
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
