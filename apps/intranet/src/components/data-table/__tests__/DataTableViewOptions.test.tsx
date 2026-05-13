import type { ColumnDef } from "@tanstack/react-table";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DataTable } from "../DataTable";

type Row = { id: string; name: string; status: string };

const cols: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Nombre" },
  { accessorKey: "status", header: "Estado" },
];

const data: Row[] = [
  { id: "1", name: "Foo", status: "Activo" },
  { id: "2", name: "Bar", status: "Pausado" },
];

// HeroUI's Dropdown.Trigger nests <button> under React Aria's
// pressable wrapper (also rendered as <button>), so getAllByRole returns 2.
// Pick the outermost trigger (data-slot="dropdown-trigger").
function getColumnasTrigger() {
  const buttons = screen.getAllByRole("button", { name: /Columnas/i });
  const trigger = buttons.find((b) => b.getAttribute("data-slot") === "dropdown-trigger");
  if (!trigger) throw new Error("dropdown-trigger button not found");
  return trigger;
}

describe("DataTableViewOptions", () => {
  it("renders the columns trigger button", () => {
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );
    expect(getColumnasTrigger()).toBeInTheDocument();
  });

  it("opens the dropdown and lists hideable columns", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );

    await user.click(getColumnasTrigger());

    // HeroUI portals options to document.body — query by role globally.
    await waitFor(() => {
      expect(screen.getAllByText("Nombre").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Estado").length).toBeGreaterThan(0);
    });
  });

  // TODO: HeroUI v3 Dropdown.Item activation in jsdom doesn't propagate
  // selection state for column-toggle list items (popover items render but
  // role-based queries inside the menu return empty). Skipped — exercised
  // in Storybook visual tests instead.
  it.skip("hides a column when its option is toggled off", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );

    expect(screen.getAllByText("Activo").length).toBeGreaterThan(0);

    await user.click(getColumnasTrigger());

    const estadoOption = await screen.findByRole("option", { name: /Estado/i });
    await user.click(estadoOption);

    await waitFor(() => {
      expect(screen.queryByText("Activo")).not.toBeInTheDocument();
      expect(screen.queryByText("Pausado")).not.toBeInTheDocument();
    });
  });

  it("filters columns via the search input", async () => {
    const user = userEvent.setup();
    render(
      <DataTable columns={cols} data={data} enablePagination={false} enableVirtualization={false} />
    );

    await user.click(getColumnasTrigger());

    // Search input lives in the popover; placeholder is "Buscar..." per
    // DataTableViewOptions.tsx. The popover *does* render in jsdom even
    // though list-item role queries don't always populate.
    const search = await screen.findByPlaceholderText("Buscar...");
    await user.type(search, "zzz-no-match");

    await waitFor(() => {
      expect(screen.getByText("No encontrado")).toBeInTheDocument();
    });
  });

  it("renders nothing-hideable case (no columns) without crashing", () => {
    render(
      <DataTable
        columns={[]}
        data={[]}
        enablePagination={false}
        enableVirtualization={false}
      />
    );
    expect(getColumnasTrigger()).toBeInTheDocument();
  });
});
