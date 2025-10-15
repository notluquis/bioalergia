import CollapsibleSection from "../../components/CollapsibleSection";
import ServiceTemplateGallery from "../../features/services/components/ServiceTemplateGallery";
import Alert from "../../components/Alert";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";

export default function ServicesTemplatesContent() {
  const { canManage, applyTemplate } = useServicesOverview();

  return (
    <section className="flex flex-col gap-6">
      {!canManage && (
        <Alert variant="warning">Solo administradores pueden crear o editar servicios mediante plantillas.</Alert>
      )}

      <CollapsibleSection
        title="Plantillas disponibles"
        defaultOpen
        description="Selecciona una plantilla y serás redirigido al editor con los datos precargados"
      >
        <ServiceTemplateGallery onApply={applyTemplate} />
      </CollapsibleSection>
    </section>
  );
}
