import { DataTable } from "@/components/data-table/DataTable";
import { columns, type TransactionWithRelations } from "./CashFlowColumns";

interface Props {
  data: TransactionWithRelations[];
  isLoading: boolean;
  total: number;
  page: number; // 1-indexed
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (tx: TransactionWithRelations) => void;
}

export function CashFlowTable({
  data,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onEdit,
}: Props) {
  // Convert 1-indexed page to 0-indexed for DataTable
  const pagination = {
    pageIndex: page - 1,
    pageSize,
  };

  return (
    <DataTable
      columns={columns}
      data={data}
      pageCount={Math.ceil(total / pageSize)}
      pagination={pagination}
      onPaginationChange={(updater) => {
        if (typeof updater === "function") {
          const newState = updater(pagination);
          onPageChange(newState.pageIndex + 1);
        } else {
          onPageChange(updater.pageIndex + 1);
        }
      }}
      isLoading={isLoading}
      meta={{ onEdit }}
      enableGlobalFilter={false} // Handled by parent
    />
  );
}
