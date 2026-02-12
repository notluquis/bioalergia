import { Surface } from "@heroui/react";
import { Link } from "@tanstack/react-router";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ServiceForm } from "@/features/services/components/ServiceForm";
import { SERVICE_TEMPLATES } from "@/features/services/components/ServiceTemplateGallery";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
export function ServicesCreateContent() {
  const { applyTemplate, canManage, createError, handleCreateService, selectedTemplate } =
    useServicesOverview();

  if (!canManage) {
    return <Alert status="danger">Solo administradores pueden crear servicios.</Alert>;
  }

  return (
    <section className="space-y-8">
      <Surface className="rounded-[28px] p-6 shadow-inner space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground text-sm">Plantillas rápidas</p>
              <p className="text-default-500 text-xs">
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
                className="rounded-full border border-default-200 bg-default-50 px-3 py-1 font-semibold text-foreground text-xs transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
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
      </Surface>

      <Surface className="rounded-[28px] p-6 shadow-inner space-y-6">
        <div className="space-y-4">
          <p className="font-semibold text-foreground text-sm">Formulario de creación</p>
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

          {createError && <p className="text-rose-600 text-sm">{createError}</p>}
        </div>
      </Surface>
    </section>
  );
}
