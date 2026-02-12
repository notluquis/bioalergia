import { Surface } from "@heroui/react";
import { Alert } from "@/components/ui/Alert";
import { ServiceTemplateGallery } from "@/features/services/components/ServiceTemplateGallery";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
export function ServicesTemplatesContent() {
  const { applyTemplate, canManage } = useServicesOverview();

  return (
    <section className="space-y-8">
      {!canManage && (
        <Alert status="warning">
          Solo administradores pueden crear o editar servicios mediante plantillas.
        </Alert>
      )}

      <Surface className="rounded-[28px] p-6 shadow-inner space-y-6">
        <ServiceTemplateGallery onApply={applyTemplate} />
      </Surface>
    </section>
  );
}
