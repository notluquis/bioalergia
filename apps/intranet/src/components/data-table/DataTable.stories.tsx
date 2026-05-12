import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "./DataTable";

type Row = {
  id: string;
  name: string;
  status: "Activo" | "Pausado" | "Pendiente";
  amount: number;
};

const columns: ColumnDef<Row>[] = [
  {
    accessorKey: "name",
    header: "Nombre",
  },
  {
    accessorKey: "status",
    header: "Estado",
  },
  {
    accessorKey: "amount",
    header: "Monto",
    cell: ({ getValue }) => {
      const value = getValue<number>();
      return <span className="tabular-nums">${value.toLocaleString("es-CL")}</span>;
    },
  },
];

const data: Row[] = [
  { id: "1", name: "Suscripción mensual", status: "Activo", amount: 42000 },
  { id: "2", name: "Inmunoterapia", status: "Pendiente", amount: 118000 },
  { id: "3", name: "Control anual", status: "Pausado", amount: 36000 },
];

const longData: Row[] = Array.from({ length: 120 }, (_, index) => ({
  id: String(index + 1),
  name: `Servicio ${index + 1}`,
  status: index % 3 === 0 ? "Activo" : index % 3 === 1 ? "Pausado" : "Pendiente",
  amount: 15000 + index * 1000,
}));

const meta: Meta = {
  title: "Data/DataTable",
};

export default meta;

type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <div className="max-w-3xl">
      <DataTable columns={columns} data={data} enableVirtualization={false} />
    </div>
  ),
};

export const ScrollMaxHeight: Story = {
  // React Aria's Virtualizer reads layout dimensions during the first render
  // pass; in the addon-vitest headless runner the container resolves to
  // 0×0 before measurements, causing the virtualizer to throw. Real
  // browsers (Chromatic, dev) give it a viewport. Tag so vitest skips,
  // Chromatic still snapshots.
  tags: ["!test"],
  render: () => (
    <div className="max-w-4xl">
      <DataTable columns={columns} data={longData} scrollMaxHeight="24rem" />
    </div>
  ),
};

export const NonPaginatedAutoScroll: Story = {
  render: () => (
    <div className="max-w-4xl">
      <DataTable
        columns={columns}
        data={longData}
        enablePagination={false}
        enableVirtualization={false}
      />
    </div>
  ),
};

export const PageScrollMode: Story = {
  render: () => (
    <div className="max-w-4xl">
      <DataTable
        columns={columns}
        data={longData}
        enablePagination={false}
        enableVirtualization={false}
        scrollMode="page"
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div className="max-w-3xl">
      <DataTable
        columns={columns}
        data={[]}
        enableVirtualization={false}
        noDataMessage="Sin resultados para los filtros aplicados."
      />
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="max-w-3xl">
      <DataTable columns={columns} data={[]} enableVirtualization={false} isLoading />
    </div>
  ),
};

export const WithToolbar: Story = {
  render: () => (
    <div className="max-w-3xl">
      <DataTable columns={columns} data={data} enableVirtualization={false} enableToolbar />
    </div>
  ),
};
