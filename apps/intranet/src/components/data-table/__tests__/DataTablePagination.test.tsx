import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "../DataTable";

type Row = { id: string; name: string };

const cols: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Nombre" }];

const makeRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Fila ${i + 1}` }));

type DataTableProps = React.ComponentProps<typeof DataTable<Row, unknown>>;

function renderTable(rowCount: number, extra: Partial<DataTableProps> = {}) {
  return render(
    <DataTable<Row, unknown>
      columns={cols}
      data={makeRows(rowCount)}
      enableToolbar={false}
      enableVirtualization={false}
      {...extra}
    />
  );
}

describe("DataTablePagination", () => {
  it("renders summary with current page and total when total is known", () => {
    renderTable(25);
    // 25 rows / 10 page size = 3 pages
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
  });

  it("disables Previous on first page and enables Next", () => {
    renderTable(25);
    const previous = screen.getByRole("button", { name: /Anterior/i });
    const next = screen.getByRole("button", { name: /Siguiente/i });
    expect(previous).toBeDisabled();
    expect(next).not.toBeDisabled();
  });

  it("advances the pagination summary when Next is pressed", async () => {
    const user = userEvent.setup();
    renderTable(25);
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Siguiente/i }));
    // Pagination summary updates synchronously.
    expect(screen.getByText(/Página 2 de 3/)).toBeInTheDocument();
  });

  it("goes to a specific page when a numbered link is pressed", async () => {
    const user = userEvent.setup();
    renderTable(25);
    const page2 = screen.getByRole("button", { name: "2" });
    await user.click(page2);
    expect(screen.getByText(/Página 2 de 3/)).toBeInTheDocument();
  });

  it("returns to previous page when Previous is pressed", async () => {
    const user = userEvent.setup();
    renderTable(25);
    await user.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(screen.getByText(/Página 2 de 3/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Anterior/i }));
    expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument();
  });

  it("hides page-size selector when only one option is available", () => {
    renderTable(5, { pageSizeOptions: [10] });
    expect(screen.queryByText(/Filas/i)).not.toBeInTheDocument();
  });

  it("shows page-size selector label when multiple options are given", () => {
    renderTable(25, { pageSizeOptions: [10, 25, 50] });
    expect(screen.getByText("Filas")).toBeInTheDocument();
  });

  it("renders summary without total when pageCount is unknown (manual pagination)", () => {
    // Using manual pagination triggers the !hasKnownTotalPages branch when pageCount is -1
    render(
      <DataTable
        columns={cols}
        data={makeRows(10)}
        enableToolbar={false}
        enableVirtualization={false}
        pageCount={-1}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Página 1$/)).toBeInTheDocument();
  });

  it("disables Next when on the last page", async () => {
    const user = userEvent.setup();
    renderTable(15);
    // Page 1 of 2
    await user.click(screen.getByRole("button", { name: /Siguiente/i }));
    expect(screen.getByText(/Página 2 de 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siguiente/i })).toBeDisabled();
  });
});
