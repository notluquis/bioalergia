import { Alert } from "@/components/ui/Alert";
import { ServicesSurface } from "@/features/services/components/ServicesShell";
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

      <ServicesSurface>
        <ServiceTemplateGallery onApply={applyTemplate} />
      </ServicesSurface>
    </section>
  );
}
