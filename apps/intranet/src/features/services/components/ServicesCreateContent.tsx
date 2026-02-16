import { Description, Surface } from "@heroui/react";

import { Alert } from "@/components/ui/Alert";
import { ServiceForm } from "@/features/services/components/ServiceForm";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
export function ServicesCreateContent() {
  const { canManage, createError, handleCreateService, selectedTemplate } = useServicesOverview();

  if (!canManage) {
    return <Alert status="danger">Solo administradores pueden crear servicios.</Alert>;
  }

  return (
    <section className="space-y-8">
      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="space-y-4">
          <span className="block font-semibold text-foreground text-sm">Crear Nuevo Servicio</span>
          <ServiceForm
            initialValues={selectedTemplate?.payload}
            onCancel={() => {
              /* handled en overview modal, noop aquí */
            }}
            onSubmit={async (payload) => {
              await handleCreateService(payload);
            }}
            submitLabel="Crear servicio"
          />

          {createError && (
            <Description className="text-rose-600 text-sm">{createError}</Description>
          )}
        </div>
      </Surface>
    </section>
  );
}
