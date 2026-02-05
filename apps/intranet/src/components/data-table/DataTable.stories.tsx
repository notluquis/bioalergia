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
