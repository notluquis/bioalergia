import Button from "../../../components/ui/Button";
import type { InventoryItem } from "../types";

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  openAdjustStockModal: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
}

export default function InventoryTable({ items, loading, openAdjustStockModal, openEditModal }: InventoryTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
      <div className="overflow-x-auto muted-scrollbar">
        <table className="min-w-full text-sm">
          <thead className="bg-base-200 text-base-content">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Categoría</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Descripción</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Stock Actual</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="odd:bg-base-200/60">
                <td className="px-4 py-3 font-medium text-base-content">{item.name}</td>
                <td className="px-4 py-3 text-base-content">{item.category_name ?? "Sin categoría"}</td>
                <td className="px-4 py-3 text-base-content/60">{item.description ?? "—"}</td>
                <td className="px-4 py-3 text-base-content">{item.current_stock}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                  <Button variant="secondary" onClick={() => openAdjustStockModal(item)} className="mr-3">
                    Ajustar Stock
                  </Button>
                  <Button variant="secondary" onClick={() => openEditModal(item)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-base-content/60">
                  No hay items en el inventario.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-primary">
                  Cargando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
