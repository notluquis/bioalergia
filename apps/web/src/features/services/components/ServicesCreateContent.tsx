import { Link } from "@tanstack/react-router";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ServiceForm from "@/features/services/components/ServiceForm";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import { SERVICE_TEMPLATES } from "@/features/services/components/ServiceTemplateGallery";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";

export default function ServicesCreateContent() {
  const { applyTemplate, canManage, createError, handleCreateService, selectedTemplate } =
    useServicesOverview();

  if (!canManage) {
    return <Alert variant="error">Solo administradores pueden crear servicios.</Alert>;
  }

  return (
    <section className="space-y-8">
      <ServicesHero
        actions={
          <Link to="/services">
            <Button variant="ghost">Volver al panel</Button>
          </Link>
        }
        description="Usa una plantilla o completa el formulario manualmente para incorporar nuevos servicios recurrentes."
        title="Crear servicio"
      />

      <ServicesSurface>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base-content text-sm font-semibold">Plantillas rápidas</p>
              <p className="text-base-content/60 text-xs">
                Aplica una plantilla sugerida y ajusta los datos antes de guardar.
              </p>
            </div>
            <Link to="/services/templates">
              <Button size="sm" variant="ghost">
                Ver todas
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TEMPLATES.map((template) => (
              <button
                className="border-base-300 bg-base-200 text-base-content hover:border-primary/40 hover:bg-primary/10 hover:text-primary rounded-full border px-3 py-1 text-xs font-semibold transition"
                key={template.id}
                onClick={() => {
                  applyTemplate(template);
                }}
                type="button"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      </ServicesSurface>

      <ServicesSurface>
        <div className="space-y-4">
          <p className="text-base-content text-sm font-semibold">Formulario de creación</p>
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
          {createError && <p className="text-sm text-rose-600">{createError}</p>}
        </div>
      </ServicesSurface>
    </section>
  );
}
