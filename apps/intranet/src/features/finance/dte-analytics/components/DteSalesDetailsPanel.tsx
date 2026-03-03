import { Card, Description, Label, ListBox, Select } from "@heroui/react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/data-table/DataTable";
import { dteAnalyticsKeys } from "@/features/finance/dte-analytics/queries";
import type { DTESalesDetail } from "@/features/finance/dte-analytics/types";
import { formatCurrency } from "@/features/finance/dte-analytics/utils";

const salesColumns: ColumnDef<DTESalesDetail>[] = [
  {
    accessorKey: "registerNumber",
    header: "register_number",
  },
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
];

const DEFAULT_PAGE_SIZE = 50;

export function DteSalesDetailsPanel() {
  const { data: periods } = useSuspenseQuery(dteAnalyticsKeys.salesAvailablePeriods());
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
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
      <div className="flex flex-wrap items-end gap-3">
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
                <ListBox.Item id={period} key={period}>
                  {period}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Description>
          {detailsQuery.data?.meta.total ?? 0} registros en {selectedPeriod}
        </Description>
      </div>

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
    </div>
  );
}
