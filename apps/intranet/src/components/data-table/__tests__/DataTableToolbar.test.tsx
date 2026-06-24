import type { ColumnDef } from "@tanstack/react-table";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "../DataTable";
import type { DataTableFilterOption } from "../DataTableToolbar";

type Row = { id: string; name: string; status: string };

const cols: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Nombre" },
  { accessorKey: "status", header: "Estado", filterFn: "arrIncludesSome" },
];

const data: Row[] = [
  { id: "1", name: "Foo", status: "activo" },
  { id: "2", name: "Bar", status: "pausado" },
];

const filters: DataTableFilterOption[] = [
  {
    columnId: "status",
    title: "Estado",
    options: [{ label: "Activo", value: "activo" }],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DataTableToolbar", () => {
  it("renders the global filter input by default", () => {
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );
    expect(screen.getByPlaceholderText("Filtrar...")).toBeInTheDocument();
  });

  it("hides the global filter when enableGlobalFilter=false", () => {
    render(
      <DataTable
        columns={cols}
        data={data}
        enableGlobalFilter={false}
        enablePagination={false}
        enableVirtualization={false}
      />
    );
    expect(screen.queryByPlaceholderText("Filtrar...")).not.toBeInTheDocument();
  });

  it("renders an export button when export is enabled", () => {
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );
    expect(screen.getByRole("button", { name: /Exportar CSV/i })).toBeInTheDocument();
  });

  it("hides the export button when enableExport=false", () => {
    render(
      <DataTable
        columns={cols}
        data={data}
        enableExport={false}
        enablePagination={false}
        enableVirtualization={false}
      />
    );
    expect(screen.queryByRole("button", { name: /Exportar CSV/i })).not.toBeInTheDocument();
  });

  it("renders faceted filter triggers when filters are configured", () => {
    render(
      <DataTable
        columns={cols}
        data={data}
        enablePagination={false}
        enableVirtualization={false}
        filters={filters}
      />
    );
    // Faceted filter trigger uses the title as button label.
    const triggers = screen.getAllByRole("button", { name: /Estado/i });
    expect(triggers.length).toBeGreaterThan(0);
  });

  // TODO: HeroUI's SearchField + React Aria don't propagate fireEvent.input
  // /change /userEvent.type to TanStack Table's setGlobalFilter in jsdom
  // (pointer/key event buffering). Storybook visual tests cover the live
  // filtering interaction in a real browser.
  it.skip("filters rows when changing the global filter input", async () => {
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );

    expect(screen.getByText("Foo")).toBeInTheDocument();
    expect(screen.getByText("Bar")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Filtrar...") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "Foo" } });

    await waitFor(() => {
      expect(screen.queryByText("Bar")).not.toBeInTheDocument();
      expect(screen.getByText("Foo")).toBeInTheDocument();
    });
  });

  it("clicking the export button triggers a CSV download (anchor click + URL.createObjectURL)", async () => {
    const user = userEvent.setup();

    // jsdom lacks URL.createObjectURL — stub it.
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL,
    });

    // Spy on anchor.click — JSDom's HTMLAnchorElement.prototype.click is a no-op.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );

    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does not render a Reset button when no column filters are active", () => {
    render(
      <DataTable
        columns={cols}
        data={data}
        enablePagination={false}
        enableVirtualization={false}
        filters={filters}
      />
    );
    expect(screen.queryByRole("button", { name: /^Reset$/i })).not.toBeInTheDocument();
  });
});
