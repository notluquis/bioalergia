import Alert from "../../components/Alert";
import ServiceForm from "../../features/services/components/ServiceForm";
import { ServicesHero, ServicesSurface } from "../../features/services/components/ServicesShell";
import { SERVICE_TEMPLATES } from "../../features/services/components/ServiceTemplateGallery";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";
import Button from "../../components/Button";
import { Link } from "react-router-dom";

export default function ServicesCreateContent() {
  const { canManage, applyTemplate, createError, selectedTemplate, handleCreateService } = useServicesOverview();

  if (!canManage) {
    return <Alert variant="error">Solo administradores pueden crear servicios.</Alert>;
  }

  return (
    <section className="space-y-8">
      <ServicesHero
        title="Crear servicio"
        description="Usa una plantilla o completa el formulario manualmente para incorporar nuevos servicios recurrentes."
        breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Crear" }]}
        actions={
          <Link to="/services">
            <Button variant="ghost">Volver al panel</Button>
          </Link>
        }
      />

      <ServicesSurface>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-base-content">Plantillas rápidas</p>
              <p className="text-xs text-base-content/60">
                Aplica una plantilla sugerida y ajusta los datos antes de guardar.
              </p>
            </div>
            <Link to="/services/templates">
              <Button variant="ghost" size="sm">
                Ver todas
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="rounded-full border border-base-300 bg-base-200 px-3 py-1 text-xs font-semibold text-base-content transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      </ServicesSurface>

      <ServicesSurface>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-base-content">Formulario de creación</p>
          <ServiceForm
            onSubmit={async (payload) => {
              await handleCreateService(payload);
            }}
            onCancel={() => {
              /* handled en overview modal, noop aquí */
            }}
            initialValues={selectedTemplate?.payload}
            submitLabel="Crear servicio"
          />
          {createError && <p className="text-sm text-rose-600">{createError}</p>}
        </div>
      </ServicesSurface>
    </section>
  );
}
