import { Description, Surface } from "@heroui/react";
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
      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="block font-semibold text-foreground text-sm">
                Plantillas rápidas
              </span>
              <Description className="text-default-500 text-xs">
                Aplica una plantilla sugerida y ajusta los datos antes de guardar.
              </Description>
            </div>
            <Link to="/services/templates">
              <Button size="sm" variant="ghost">
                Ver todas
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {SERVICE_TEMPLATES.map((template) => (
              <Button
                className="rounded-full border border-default-200 bg-default-50 px-3 py-1 font-semibold text-foreground text-xs transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                key={template.id}
                onPress={() => {
                  applyTemplate(template);
                }}
                type="button"
                variant="ghost"
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      </Surface>

      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="space-y-4">
          <span className="block font-semibold text-foreground text-sm">
            Formulario de creación
          </span>
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
