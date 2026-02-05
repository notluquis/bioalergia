import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    totals?: {
      extraAmount: number;
      hours: string;
      net: number;
      overtime: string;
      retention: number;
      subtotal: number;
    };
  }
}
