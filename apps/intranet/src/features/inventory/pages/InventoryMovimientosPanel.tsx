import {
  Button,
  Chip,
  DateField,
  DateRangePicker,
  EmptyState,
  Label,
  RangeCalendar,
  SearchField,
  Skeleton,
  Surface,
  Table,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@tanstack/react-pacer";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

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

      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Movimientos de inventario">
            <Table.Header>
              <Table.Column isRowHeader>Fecha</Table.Column>
              <Table.Column>Item</Table.Column>
              <Table.Column>Cantidad</Table.Column>
              <Table.Column>Motivo</Table.Column>
            </Table.Header>
            <Table.Body
              items={rows}
              renderEmptyState={() =>
                query.isLoading ? (
                  <div className="space-y-2 p-2">
                    <Skeleton className="h-8 rounded-md" />
                    <Skeleton className="h-8 rounded-md" />
                    <Skeleton className="h-8 rounded-md" />
                  </div>
                ) : (
                  <EmptyState className="p-6 text-center">
                    Sin movimientos para los filtros seleccionados.
                  </EmptyState>
                )
              }
            >
              {(movement) => {
                const isPositive = movement.quantity_change >= 0;
                return (
                  <Table.Row id={String(movement.id)}>
                    <Table.Cell className="tabular-nums">
                      {dayjs(movement.created_at).format("DD/MM/YYYY HH:mm")}
                    </Table.Cell>
                    <Table.Cell>{movement.item.name}</Table.Cell>
                    <Table.Cell>
                      <Chip color={isPositive ? "success" : "danger"} size="sm" variant="soft">
                        {isPositive ? "↑" : "↓"} {Math.abs(movement.quantity_change)}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-foreground-500">
                      {movement.reason ?? "—"}
                    </Table.Cell>
                  </Table.Row>
                );
              }}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

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
