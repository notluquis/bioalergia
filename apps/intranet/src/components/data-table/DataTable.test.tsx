import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./DataTable";

type Row = {
  id: string;
  name: string;
};

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
  },
];

const rows: Row[] = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  name: `Fila ${i + 1}`,
}));

function getScrollContainer() {
  const table = screen.getByRole("table");
  const container = table.parentElement;
  if (!container) {
    throw new Error("No se encontró contenedor de scroll de la tabla");
  }
  return container as HTMLDivElement;
}

describe("DataTable scroll behavior", () => {
  it("does not force internal vertical scroll by default in paginated small tables", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        enableToolbar={false}
        enableVirtualization={false}
      />,
    );

    const container = getScrollContainer();
    expect(container.style.overflowY).toBe("");
    expect(container.style.maxHeight).toBe("");
  });

  it("enables internal vertical scroll when scrollMaxHeight is provided", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        enableToolbar={false}
        enableVirtualization={false}
        scrollMaxHeight="24rem"
      />,
    );

    const container = getScrollContainer();
    expect(container.style.overflowY).toBe("auto");
    expect(container.style.maxHeight).toBe("24rem");
  });

  it("enables container scroll automatically when pagination is disabled", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
      />,
    );

    const container = getScrollContainer();
    expect(container.style.overflowY).toBe("auto");
    expect(container.style.maxHeight).toBe("70dvh");
  });

  it("delegates vertical scroll to page when scrollMode is page", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        enablePagination={false}
        enableToolbar={false}
        enableVirtualization={false}
        scrollMode="page"
      />,
    );

    const container = getScrollContainer();
    expect(container.style.overflowY).toBe("");
    expect(container.style.maxHeight).toBe("");
  });
});
