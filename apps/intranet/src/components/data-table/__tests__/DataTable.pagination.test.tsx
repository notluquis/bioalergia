import type { ColumnDef, PaginationState } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "../DataTable";

// Regresión: la paginación no cambiaba de página. Causa raíz — DataTableContent
// (hijo) llamaba table.getRowModel() con `table` recibido por prop mientras
// useReactTable vivía en el padre; el memo del row model de TanStack quedaba
// STALE por el orden de render padre→hijo (getState().pagination ya era la página
// nueva pero getRowModel() devolvía la anterior). Fix: computar el row model en el
// padre (DataTable) y pasar las filas por prop. Ver comentario en DataTable.tsx.

type Row = { id: string; name: string };
const cols: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Nombre" }];
const data: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `Fila ${i + 1}`,
}));

function Harness({ pagination }: { pagination: PaginationState }) {
  return (
    <DataTable
      columns={cols}
      data={data}
      enableToolbar={false}
      enableVirtualization={false}
      onPaginationChange={() => {}}
      pagination={pagination}
    />
  );
}

describe("DataTable pagination (regression)", () => {
  it("renders the requested page on mount", () => {
    render(<Harness pagination={{ pageIndex: 1, pageSize: 10 }} />);
    expect(screen.getByText("Fila 11")).toBeInTheDocument();
    expect(screen.queryByText("Fila 1")).not.toBeInTheDocument();
  });

  it("updates the displayed rows when pageIndex changes via re-render", () => {
    const { rerender } = render(<Harness pagination={{ pageIndex: 0, pageSize: 10 }} />);
    expect(screen.getByText("Fila 1")).toBeInTheDocument();

    rerender(<Harness pagination={{ pageIndex: 1, pageSize: 10 }} />);
    expect(screen.getByText("Fila 11")).toBeInTheDocument();
    expect(screen.queryByText("Fila 1")).not.toBeInTheDocument();
  });

  it("updates the displayed rows when pageSize changes via re-render", () => {
    const { rerender } = render(<Harness pagination={{ pageIndex: 0, pageSize: 10 }} />);
    expect(screen.queryByText("Fila 11")).not.toBeInTheDocument();

    rerender(<Harness pagination={{ pageIndex: 0, pageSize: 25 }} />);
    expect(screen.getByText("Fila 11")).toBeInTheDocument();
    expect(screen.getByText("Fila 25")).toBeInTheDocument();
  });
});
