import { Alert, Surface } from "@heroui/react";

/**
 * `/inventory?tab=movimientos` panel — audit log + stock adjustments.
 *
 * Stock adjustments are surfaced from the items table (the "Ajustar
 * stock" row action). A dedicated audit-log view is not implemented
 * yet — the placeholder keeps the tab discoverable and documents the
 * gap for the next iteration.
 */
export function InventoryMovimientosPanel() {
  return (
    <Surface className="space-y-4 rounded-[28px] p-6 shadow-inner">
      <Alert status="default">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Próximamente</Alert.Title>
          <Alert.Description>
            El historial de movimientos de inventario aparecerá aquí. Por ahora, los ajustes de
            stock se realizan desde la pestaña <strong>Items</strong> usando la acción &quot;Ajustar
            stock&quot; en cada fila.
          </Alert.Description>
        </Alert.Content>
      </Alert>
    </Surface>
  );
}
