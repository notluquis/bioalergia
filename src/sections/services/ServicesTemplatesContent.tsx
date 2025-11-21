import ServiceTemplateGallery from "../../features/services/components/ServiceTemplateGallery";
import Alert from "../../components/ui/Alert";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";
import { ServicesHero, ServicesSurface } from "../../features/services/components/ServicesShell";
import Button from "../../components/ui/Button";
import { Link } from "react-router-dom";

export default function ServicesTemplatesContent() {
  const { canManage, applyTemplate } = useServicesOverview();

  return (
    <section className="space-y-8">
      {!canManage && (
        <Alert variant="warning">Solo administradores pueden crear o editar servicios mediante plantillas.</Alert>
      )}

      <ServicesHero
        title="Plantillas de servicios"
        description="Reutiliza configuraciones predefinidas para acelerar la creación de servicios recurrentes."
        breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Plantillas" }]}
        actions={
          <Link to="/services/create">
            <Button variant="ghost">Ir a crear</Button>
          </Link>
        }
      />

      <ServicesSurface>
        <ServiceTemplateGallery onApply={applyTemplate} />
      </ServicesSurface>
    </section>
  );
}
