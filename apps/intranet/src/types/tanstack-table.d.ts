import "@tanstack/react-table";

import type { BalanceDraft } from "@/features/finance/balances/types";
import type { InventoryItem } from "@/features/inventory/types";
import type { SupplyRequest } from "@/features/supplies/types";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    className?: string;
    headerClassName?: string;
    isRowHeader?: boolean;
  }

  interface TableMeta<TData extends RowData> {
    totals?: {
      extraAmount: number;
      hours: string;
      net: number;
      overtime: string;
      retention: number;
      subtotal: number;
    };
    drafts?: Record<string, BalanceDraft>;
    onDraftChange?: (date: string, patch: Partial<BalanceDraft>) => void;
    onSave?: (date: string) => void;
    saving?: Record<string, boolean>;

    canEdit?: boolean;
    onActivate?: (id: number) => void;
    onDeactivate?: (id: number) => void;
    onEdit?: (row: TData) => void;

    canAdjust?: boolean;
    canUpdate?: boolean;
    openAdjustStockModal?: (item: InventoryItem) => void;
    openEditModal?: (item: InventoryItem) => void;

    isAdmin?: boolean;
    onStatusChange?: (requestId: number, newStatus: SupplyRequest["status"]) => void;

    onCategoryChange?: (row: TData, categoryId: null | number) => void;
    onReallocate?: (row: TData) => void;
    transactionCategories?: Array<{
      color?: null | string;
      icon?: null | string;
      id: number;
      name: string;
    }>;
    updatingCategoryIds?: Set<number>;
  }
}
