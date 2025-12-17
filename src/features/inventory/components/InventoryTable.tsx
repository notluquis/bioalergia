import Button from "@/components/ui/Button";
import type { InventoryItem } from "../types";

interface InventoryTableProps {
  items: InventoryItem[];
  loading: boolean;
  openAdjustStockModal: (item: InventoryItem) => void;
  openEditModal: (item: InventoryItem) => void;
}

export default function InventoryTable({ items, loading, openAdjustStockModal, openEditModal }: InventoryTableProps) {
  return (
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border shadow-sm">
      <div className="muted-scrollbar overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-base-200 text-base-content">
            <tr>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Nombre</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Categoría</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Descripción</th>
              <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Stock actual</th>
              <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="odd:bg-base-200/60">
                <td className="text-base-content px-4 py-3 font-medium">{item.name}</td>
                <td className="text-base-content px-4 py-3">{item.category_name ?? "Sin categoría"}</td>
                <td className="text-base-content/60 px-4 py-3">{item.description ?? "—"}</td>
                <td className="text-base-content px-4 py-3">{item.current_stock}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                  <Button variant="secondary" onClick={() => openAdjustStockModal(item)} className="mr-3">
                    Ajustar stock
                  </Button>
                  <Button variant="secondary" onClick={() => openEditModal(item)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
            {!items.length && !loading && (
              <tr>
                <td colSpan={5} className="text-base-content/60 px-4 py-6 text-center">
                  No hay items en el inventario.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={5} className="text-primary px-4 py-6 text-center">
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
