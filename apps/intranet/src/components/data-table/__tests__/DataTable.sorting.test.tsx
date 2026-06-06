import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "../DataTable";

// Cubre el orden CONTROLADO + manualSorting (server-side). Con manualSorting el
// DataTable NO reordena en cliente: respeta el orden de `data` (el padre ya
// ordenó vía su query). Sin él, el row model ordenaría client-side.

type Row = { id: string; name: string };
const cols: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Nombre", enableSorting: true }];
// Orden de inserción a propósito NO alfabético.
const data: Row[] = [
  { id: "1", name: "Charlie" },
  { id: "2", name: "Alpha" },
  { id: "3", name: "Bravo" },
];

function rowOrder() {
  return screen.getAllByRole("rowheader").map((el) => el.textContent);
}

describe("DataTable controlled/manual sorting", () => {
  it("manualSorting respeta el orden de data (no reordena en cliente)", () => {
    const sorting: SortingState = [{ id: "name", desc: false }];
    render(
      <DataTable
        columns={cols}
        data={data}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        manualSorting
        onSortingChange={() => {}}
        sorting={sorting}
      />
    );
    // Pese a sorting asc por name, se respeta el orden de `data`.
    expect(rowOrder()).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("sin manualSorting ordena en cliente según el sorting controlado", () => {
    const sorting: SortingState = [{ id: "name", desc: false }];
    render(
      <DataTable
        columns={cols}
        data={data}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        onSortingChange={() => {}}
        sorting={sorting}
      />
    );
    expect(rowOrder()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});
