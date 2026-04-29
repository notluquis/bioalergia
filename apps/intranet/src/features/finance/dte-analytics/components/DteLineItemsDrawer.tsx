import { Button, Chip, Drawer, Skeleton, Surface } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Download, Package } from "lucide-react";
import { dteAnalyticsKeys } from "../queries";
import { useFetchDteXml } from "../hooks/useFetchDteXml";
import type { DTELineItem, DTEPurchaseDetail, DTESalesDetail } from "../types";
import { formatCurrency } from "../utils";

type DteDetail = (DTEPurchaseDetail | DTESalesDetail) & { direction: "purchase" | "sale" };

interface DteLineItemsDrawerProps {
  detail: DteDetail | null;
  isOpen: boolean;
  onClose: () => void;
}

function LineItemCard({ item }: { item: DTELineItem }) {
  return (
    <Surface className="rounded-xl p-3" variant="default">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-tight">{item.itemName}</p>
          {item.itemDescription ? (
            <p className="mt-0.5 text-default-500 text-xs">{item.itemDescription}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip size="sm" variant="soft" color="default">
              {item.quantity} {item.unit ?? "un"} × {formatCurrency(item.unitPrice)}
            </Chip>
            {item.isExempt ? (
              <Chip size="sm" variant="soft" color="warning">
                Exento
              </Chip>
            ) : null}
            {item.itemCode ? (
              <Chip size="sm" variant="soft" color="accent">
                {item.itemCodeType}: {item.itemCode}
              </Chip>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 font-semibold text-sm">{formatCurrency(item.amount)}</span>
      </div>
    </Surface>
  );
}

export function DteLineItemsDrawer({ detail, isOpen, onClose }: DteLineItemsDrawerProps) {
  const fetchXmlMutation = useFetchDteXml();

  const lineItemsQuery = useQuery({
    ...dteAnalyticsKeys.lineItems(detail?.id ?? "", detail?.direction ?? "sale"),
    enabled: isOpen && !!detail && detail.lineItemsCount > 0,
  });

  const lineItems = lineItemsQuery.data ?? [];
  const hasItems = detail && detail.lineItemsCount > 0;
  const isLoading = lineItemsQuery.isLoading && hasItems;

  const drawerTitle = detail ? `Folio ${detail.folio} — Detalle XML` : "Detalle XML";

  const direction = detail?.direction === "purchase" ? "purchases" : "sales";

  function handleFetchXml() {
    if (!detail) return;
    fetchXmlMutation.mutate({ dteIds: [detail.id], direction });
  }

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <div className="space-y-2">
              <Drawer.Heading>{drawerTitle}</Drawer.Heading>
              {detail ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Chip color="default" size="sm" variant="soft">
                    {"clientName" in detail ? detail.clientName : detail.providerName}
                  </Chip>
                  <Chip color="default" size="sm" variant="soft">
                    {dayjs(detail.documentDate).format("DD-MM-YYYY")}
                  </Chip>
                  <Chip color="success" size="sm" variant="soft">
                    {formatCurrency(detail.totalAmount)}
                  </Chip>
                  {hasItems ? (
                    <Chip color="accent" size="sm" variant="soft">
                      <Package size={12} className="mr-1" />
                      {detail.lineItemsCount} ítem{detail.lineItemsCount !== 1 ? "s" : ""}
                    </Chip>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Drawer.Header>
          <Drawer.Body className="space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
            ) : null}

            {!isLoading && hasItems && lineItems.length > 0
              ? lineItems.map((item) => <LineItemCard key={item.id} item={item} />)
              : null}

            {!isLoading && !hasItems && detail ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="rounded-full bg-default-100 p-4">
                  <Package size={32} className="text-default-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-default-700">Sin detalle XML</p>
                  <p className="text-default-500 text-sm">
                    Este DTE no tiene ítems descargados aún. Puedes obtener el detalle desde
                    Haulmer.
                  </p>
                </div>
                <Button
                  isDisabled={fetchXmlMutation.isPending}
                  onPress={handleFetchXml}
                  size="md"
                  variant="primary"
                >
                  <Download size={16} />
                  Obtener detalle XML
                </Button>
                {fetchXmlMutation.isSuccess ? (
                  <Chip color="success" size="sm" variant="soft">
                    {fetchXmlMutation.data.fetched > 0
                      ? `${fetchXmlMutation.data.details[0]?.lineItemsCount ?? 0} ítems obtenidos`
                      : "No se encontró XML en Haulmer"}
                  </Chip>
                ) : null}
                {fetchXmlMutation.isError ? (
                  <Chip color="danger" size="sm" variant="soft">
                    Error al obtener XML
                  </Chip>
                ) : null}
              </div>
            ) : null}
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
