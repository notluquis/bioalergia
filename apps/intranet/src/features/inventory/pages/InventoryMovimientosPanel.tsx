import { formatChile } from "@/lib/dates";
import {
  Button,
  Chip,
  DateField,
  DateRangePicker,
  Label,
  RangeCalendar,
  SearchField,
  Surface,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import type { ColumnDef } from "@tanstack/react-table";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import type { ListMovementsResponse } from "../api";
import { inventoryQueries } from "../queries";

/**
 * `/inventory?tab=movimientos` panel — audit log of stock movements.
 *
 * Pulls from `inventory.listMovements` (paginated). Filters: date range
 * (`from`/`to` ISO `YYYY-MM-DD`) + free-text search (item name /
 * description). Cursor pagination via `useInfiniteQuery`.
 *
 * Schema note: `InventoryMovement` does NOT yet carry the acting user;
 * a future migration will add `actor_user_id` + we'll surface a usuario
 * column then.
 */
export function InventoryMovimientosPanel() {
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch] = useDebouncedValue(search, { wait: 300 });

  const filters = useMemo(
    () => ({
      from,
      search: debouncedSearch.trim() === "" ? undefined : debouncedSearch.trim(),
      to,
    }),
    [from, to, debouncedSearch]
  );

  const query = useInfiniteQuery(inventoryQueries.movements(filters));

  const rows = useMemo(
    () => query.data?.pages.flatMap((page: ListMovementsResponse) => page.data.movements) ?? [],
    [query.data]
  );

  const columns = useMemo<ColumnDef<(typeof rows)[number]>[]>(
    () => [
      {
        id: "fecha",
        header: "Fecha",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatChile(row.original.created_at, "DD/MM/YYYY HH:mm")}
          </span>
        ),
      },
      { id: "item", header: "Item", cell: ({ row }) => row.original.item.name },
      {
        id: "cantidad",
        header: "Cantidad",
        cell: ({ row }) => {
          const isPositive = row.original.quantity_change >= 0;
          return (
            <Chip color={isPositive ? "success" : "danger"} size="sm" variant="soft">
              {isPositive ? "↑" : "↓"} {Math.abs(row.original.quantity_change)}
            </Chip>
          );
        },
      },
      {
        id: "motivo",
        header: "Motivo",
        cell: ({ row }) => (
          <span className="text-foreground-500">{row.original.reason ?? "—"}</span>
        ),
      },
    ],
    []
  );

  const dateRangeValue = from && to ? { end: parseDate(to), start: parseDate(from) } : null;

  return (
    <Surface className="space-y-4 rounded-[28px] p-6 shadow-inner">
      <div className="grid gap-3 md:grid-cols-[minmax(18rem,1fr)_minmax(16rem,1fr)]">
        <DateRangePicker
          onChange={(value) => {
            setFrom(value?.start?.toString());
            setTo(value?.end?.toString());
          }}
          value={dateRangeValue}
        >
          <Label>Rango de fechas</Label>
          <DateField.Group fullWidth variant="secondary">
            <DateField.InputContainer>
              <DateField.Input slot="start">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.InputContainer>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <RangeCalendar aria-label="Rango de movimientos" visibleDuration={{ months: 2 }}>
              <RangeCalendar.Header>
                <RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.YearPickerTriggerHeading />
                  <RangeCalendar.YearPickerTriggerIndicator />
                </RangeCalendar.YearPickerTrigger>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </DateRangePicker.Popover>
        </DateRangePicker>

        <SearchField onChange={setSearch} value={search} variant="secondary">
          <Label>Buscar item</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Nombre o descripción del item..." />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {/* Cursor/infinite: el DataTable sólo renderiza las filas acumuladas
          (enablePagination=false); el botón "Cargar más" vive afuera. */}
      <DataTable
        columns={columns}
        data={rows}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        isLoading={query.isLoading}
        noDataMessage="Sin movimientos para los filtros seleccionados."
      />

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            isDisabled={query.isFetchingNextPage}
            onPress={() => {
              void query.fetchNextPage();
            }}
            variant="secondary"
          >
            {query.isFetchingNextPage ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      ) : null}
    </Surface>
  );
}
