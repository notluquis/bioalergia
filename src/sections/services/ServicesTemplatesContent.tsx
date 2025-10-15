import CollapsibleSection from "../../components/CollapsibleSection";
import ServiceTemplateGallery from "../../features/services/components/ServiceTemplateGallery";
import ServiceForm from "../../features/services/components/ServiceForm";
import Modal from "../../components/Modal";
import Alert from "../../components/Alert";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";

export default function ServicesTemplatesContent() {
  const {
    canManage,
    applyTemplate,
    openCreateModal,
    closeCreateModal,
    createOpen,
    createError,
    selectedTemplate,
    handleCreateService,
  } = useServicesOverview();

  return (
    <section className="flex flex-col gap-6">
      {!canManage && (
        <Alert variant="warning">Solo administradores pueden crear o editar servicios mediante plantillas.</Alert>
      )}

      <CollapsibleSection
        title="Plantillas disponibles"
        defaultOpen
        description="Aplica una plantilla para precargar el formulario de creación"
      >
        <ServiceTemplateGallery onApply={applyTemplate} />
        {canManage && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)] shadow hover:border-[var(--brand-primary)]/45"
            >
              Crear servicio manualmente
            </button>
          </div>
        )}
      </CollapsibleSection>

      <Modal isOpen={createOpen} onClose={closeCreateModal} title="Nuevo servicio">
        <ServiceForm
          onSubmit={async (payload) => {
            await handleCreateService(payload);
          }}
          onCancel={closeCreateModal}
          initialValues={selectedTemplate?.payload}
          submitLabel="Crear servicio"
        />
        {createError && <p className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{createError}</p>}
      </Modal>
    </section>
  );
}
