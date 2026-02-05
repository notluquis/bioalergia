import { Link } from "@tanstack/react-router";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import { ServiceTemplateGallery } from "@/features/services/components/ServiceTemplateGallery";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
export function ServicesTemplatesContent() {
  const { applyTemplate, canManage } = useServicesOverview();

  return (
    <section className="space-y-8">
      {!canManage && (
        <Alert variant="warning">
          Solo administradores pueden crear o editar servicios mediante plantillas.
        </Alert>
      )}

      <ServicesHero
        actions={
          <Link to="/services/create">
            <Button variant="ghost">Ir a crear</Button>
          </Link>
        }
        description="Reutiliza configuraciones predefinidas para acelerar la creación de servicios recurrentes."
        title="Plantillas de servicios"
      />

      <ServicesSurface>
        <ServiceTemplateGallery onApply={applyTemplate} />
      </ServicesSurface>
    </section>
  );
}
