import {
  Button,
  Card,
  Chip,
  Description,
  Drawer,
  Label,
  ListBox,
  Select,
  Skeleton,
  Surface,
} from "@heroui/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { DteLineItemsDrawer } from "./DteLineItemsDrawer";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import type {
  DTESalesDetail,
  DTESalesLinkedEvent,
  DTESalesLinkedEventsResponse,
} from "@/features/finance/dte-analytics/types";
import { formatCurrency } from "@/features/finance/dte-analytics/utils";

function seriesKindLabel(kind: DTESalesLinkedEvent["seriesKind"]) {
  if (kind === "PATCH_TEST") return "Test de parche";
  if (kind === "SKIN_TEST") return "Test cutáneo";
  if (kind === "SUBCUTANEOUS_TREATMENT") return "Tratamiento subcutáneo";
  return "Sin serie";
}

function matchedByLabel(matchedBy: DTESalesLinkedEvent["matchedBy"]) {
  if (matchedBy === "manual") return "Manual";
  if (matchedBy === "mixed") return "Nombre + RUT";
  if (matchedBy === "name_exact") return "Nombre exacto";
  if (matchedBy === "name_fuzzy") return "Nombre aproximado";
  if (matchedBy === "rut") return "RUT";
  return "No informado";
}

function buildSalesColumns(
  onOpenLinkedEvents: (detail: DTESalesDetail) => void,
  onOpenLineItems: (detail: DTESalesDetail) => void
): ColumnDef<DTESalesDetail>[] {
  return [
    {
      accessorKey: "documentType",
      header: "document_type",
    },
    {
      accessorKey: "saleType",
      header: "sale_type",
      cell: ({ row }) => (
        <span className="block max-w-44 truncate" title={row.original.saleType}>
          {row.original.saleType}
        </span>
      ),
    },
    {
      accessorKey: "clientRUT",
      header: "client_rut",
    },
    {
      accessorKey: "clientName",
      header: "client_name",
      minSize: 200,
      size: 240,
      cell: ({ row }) => (
        <span className="block max-w-72 truncate" title={row.original.clientName}>
          {row.original.clientName}
        </span>
      ),
    },
    {
      accessorKey: "folio",
      header: "folio",
    },
    {
      accessorKey: "documentDate",
      header: "document_date",
      cell: ({ row }) => dayjs(row.original.documentDate).format("DD-MM-YYYY"),
    },
    {
      accessorKey: "exemptAmount",
      header: "exempt_amount",
      cell: ({ row }) => formatCurrency(row.original.exemptAmount),
    },
    {
      accessorKey: "netAmount",
      header: "net_amount",
      cell: ({ row }) => formatCurrency(row.original.netAmount),
    },
    {
      accessorKey: "ivaAmount",
      header: "iva_amount",
      cell: ({ row }) => formatCurrency(row.original.ivaAmount),
    },
    {
      accessorKey: "totalAmount",
      header: "total_amount",
      cell: ({ row }) => (
        <span className="font-medium">{formatCurrency(row.original.totalAmount)}</span>
      ),
    },
    {
      accessorKey: "emitterRUT",
      header: "emitter_rut",
      cell: ({ row }) => row.original.emitterRUT ?? "-",
    },
    {
      accessorKey: "referenceDocType",
      header: "reference_doc_type",
      cell: ({ row }) => row.original.referenceDocType ?? "-",
    },
    {
      accessorKey: "referenceDocFolio",
      header: "reference_doc_folio",
      cell: ({ row }) => row.original.referenceDocFolio ?? "-",
    },
    {
      id: "lineItems",
      header: "ítems",
      minSize: 130,
      cell: ({ row }) => {
        const count = row.original.lineItemsCount;

        if (count === 0) {
          return (
            <Button size="sm" variant="tertiary" onPress={() => onOpenLineItems(row.original)}>
              Obtener XML
            </Button>
          );
        }

        return (
          <Button size="sm" variant="tertiary" onPress={() => onOpenLineItems(row.original)}>
            <Chip color="accent" size="sm" variant="soft">
              {count} ítem{count === 1 ? "" : "s"}
            </Chip>
          </Button>
        );
      },
    },
    {
      id: "linkedEvents",
      header: "eventos",
      minSize: 170,
      cell: ({ row }) => {
        const count = row.original.linkedEventsCount;

        if (count === 0) {
          return (
            <Chip color="default" size="sm" variant="soft">
              Sin eventos
            </Chip>
          );
        }

        return (
          <div className="flex items-center justify-end gap-2">
            <Chip color="success" size="sm" variant="soft">
              {count} evento{count === 1 ? "" : "s"}
            </Chip>
            <Button size="sm" variant="tertiary" onPress={() => onOpenLinkedEvents(row.original)}>
              Ver
            </Button>
          </div>
        );
      },
    },
  ];
}

const DEFAULT_PAGE_SIZE = 50;

interface SalesLinkedEventsDrawerProps {
  data: DTESalesLinkedEventsResponse | undefined;
  detail: DTESalesDetail | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

function SalesLinkedEventsDrawer({
  data,
  detail,
  isLoading,
  isOpen,
  onClose,
}: Readonly<SalesLinkedEventsDrawerProps>) {
  const drawerTitle = detail ? `Folio ${detail.folio}` : "Eventos vinculados";
  const resolvedDte = data?.dte ?? detail;
  const linkedEvents = data?.linkedEvents ?? [];

  return (
    <Drawer>
      <Drawer.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()} variant="blur">
        <Drawer.Content
          className="w-[min(92vw,640px)] border-l bg-background shadow-2xl"
          placement="right"
        >
          <Drawer.Dialog className="flex h-full max-h-dvh flex-col">
            <Drawer.CloseTrigger />
            <Drawer.Header className="border-default-200/70 border-b">
              <div className="space-y-2">
                <Drawer.Heading>{drawerTitle}</Drawer.Heading>
                {resolvedDte ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color="default" size="sm" variant="soft">
                      {resolvedDte.clientName}
                    </Chip>
                    <Chip color="default" size="sm" variant="soft">
                      {resolvedDte.clientRUT}
                    </Chip>
                    <Chip color="default" size="sm" variant="soft">
                      {dayjs(resolvedDte.documentDate).format("DD-MM-YYYY")}
                    </Chip>
                    <Chip color="success" size="sm" variant="soft">
                      {formatCurrency(resolvedDte.totalAmount)}
                    </Chip>
                  </div>
                ) : null}
              </div>
            </Drawer.Header>
            <Drawer.Body className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 rounded-2xl" />
                  <Skeleton className="h-28 rounded-2xl" />
                </div>
              ) : null}

              {!isLoading && resolvedDte ? (
                <Card variant="secondary">
                  <Card.Header>
                    <Card.Title className="text-sm">Resumen del DTE</Card.Title>
                    <Card.Description>
                      {resolvedDte.saleType} · Documento {resolvedDte.documentType}
                    </Card.Description>
                  </Card.Header>
                  <Card.Content className="grid grid-cols-2 gap-2 text-sm">
                    <Surface className="rounded-xl p-3" variant="default">
                      <p className="text-default-500 text-[11px] uppercase tracking-wide">Folio</p>
                      <p className="font-medium">{resolvedDte.folio}</p>
                    </Surface>
                    <Surface className="rounded-xl p-3" variant="default">
                      <p className="text-default-500 text-[11px] uppercase tracking-wide">Total</p>
                      <p className="font-medium">{formatCurrency(resolvedDte.totalAmount)}</p>
                    </Surface>
                  </Card.Content>
                </Card>
              ) : null}

              {!isLoading && linkedEvents.length === 0 ? (
                <Card variant="secondary">
                  <Card.Header>
                    <Card.Title className="text-sm">Sin eventos vinculados</Card.Title>
                    <Card.Description>
                      Este DTE no tiene eventos asociados en este momento.
                    </Card.Description>
                  </Card.Header>
                </Card>
              ) : null}

              {!isLoading && linkedEvents.length > 0 ? (
                <div className="space-y-3">
                  {linkedEvents.map((event) => (
                    <Card key={`${event.calendarId}:${event.eventId}`} variant="secondary">
                      <Card.Header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <Card.Title className="text-sm">
                            {event.summary ?? "(Sin título)"}
                          </Card.Title>
                          <Card.Description>
                            {dayjs(event.eventDate).format("DD-MM-YYYY")}
                            {event.eventTime ? ` · ${event.eventTime}` : ""}
                          </Card.Description>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Chip color="default" size="sm" variant="soft">
                            {seriesKindLabel(event.seriesKind)}
                          </Chip>
                          <Chip color="default" size="sm" variant="soft">
                            {matchedByLabel(event.matchedBy)}
                          </Chip>
                          {event.confidenceScore != null ? (
                            <Chip
                              color={event.confidenceScore >= 90 ? "success" : "warning"}
                              size="sm"
                              variant="soft"
                            >
                              Score {Math.round(event.confidenceScore)}%
                            </Chip>
                          ) : null}
                        </div>
                      </Card.Header>
                      <Card.Content className="grid grid-cols-2 gap-2 text-sm">
                        <Surface className="rounded-xl p-3" variant="default">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Serie
                          </p>
                          <p className="font-medium">{event.displayName ?? "Sin nombre visible"}</p>
                        </Surface>
                        <Surface className="rounded-xl p-3" variant="default">
                          <p className="text-default-500 text-[11px] uppercase tracking-wide">
                            Monto evento
                          </p>
                          <p className="font-medium">
                            {formatCurrency(event.amountPaid ?? event.amountExpected ?? 0)}
                          </p>
                        </Surface>
                      </Card.Content>
                    </Card>
                  ))}
                </div>
              ) : null}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

export function DteSalesDetailsPanel() {
  const { data: periods } = useSuspenseQuery(dteAnalyticsKeys.salesAvailablePeriods());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedDetail, setSelectedDetail] = useState<DTESalesDetail | null>(null);
  const [lineItemsDetail, setLineItemsDetail] = useState<DTESalesDetail | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    if (periods.length === 0) return;
    setSelectedPeriod((prev) => prev || (periods[0] ?? ""));
  }, [periods]);

  const detailsQuery = useQuery({
    ...dteAnalyticsKeys.salesDetails({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      period: selectedPeriod || undefined,
    }),
    enabled: Boolean(selectedPeriod),
  });

  const linkedEventsQuery = useQuery({
    ...dteAnalyticsKeys.salesLinkedEvents(selectedDetail?.id ?? ""),
    enabled: Boolean(selectedDetail?.id),
  });

  const salesColumns = buildSalesColumns(
    (detail) => setSelectedDetail(detail),
    (detail) => setLineItemsDetail(detail)
  );

  if (periods.length === 0) {
    return (
      <Card>
        <Card.Header>
          <Card.Title>Ventas - Detalle por período</Card.Title>
        </Card.Header>
        <Card.Content>
          <Description>No hay períodos disponibles para ventas.</Description>
        </Card.Content>
      </Card>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Surface className="flex flex-wrap items-end gap-3 rounded-2xl p-3" variant="secondary">
        <Select
          value={selectedPeriod}
          onChange={(key) => {
            setSelectedPeriod(String(key ?? ""));
            setPagination((prev) => ({ ...prev, pageIndex: 0 }));
          }}
        >
          <Label>Período</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {periods.map((period) => (
                <ListBox.Item id={period} key={period} textValue={period}>
                  {period}
                  <ListBox.ItemIndicator>
                    {({ isSelected }) =>
                      isSelected ? <Check className="h-4 w-4 text-primary" /> : null
                    }
                  </ListBox.ItemIndicator>
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Description>
          {detailsQuery.data?.meta.total ?? 0} registros en {selectedPeriod}
        </Description>
      </Surface>

      <div className="min-h-0 flex-1">
        <DataTable
          autoFitColumns={false}
          columns={salesColumns}
          containerVariant="plain"
          data={detailsQuery.data?.data ?? []}
          enableGlobalFilter={false}
          isLoading={detailsQuery.isLoading}
          onPaginationChange={(updater) => {
            if (typeof updater === "function") {
              setPagination((prev) => updater(prev));
              return;
            }
            setPagination(updater);
          }}
          pageCount={detailsQuery.data?.meta.totalPages ?? 0}
          pagination={pagination}
          scrollMaxHeight="calc(100dvh - 20rem)"
          scrollMode="container"
        />
      </div>

      <SalesLinkedEventsDrawer
        data={linkedEventsQuery.data}
        detail={selectedDetail}
        isLoading={linkedEventsQuery.isLoading}
        isOpen={selectedDetail != null}
        onClose={() => setSelectedDetail(null)}
      />

      <DteLineItemsDrawer
        detail={lineItemsDetail ? { ...lineItemsDetail, direction: "sale" } : null}
        isOpen={lineItemsDetail != null}
        onClose={() => setLineItemsDetail(null)}
      />
    </div>
  );
}
