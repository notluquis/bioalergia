import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import CollapsibleSection from "../../components/CollapsibleSection";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import ServiceDetail from "../../features/services/components/ServiceDetail";
import ServiceForm from "../../features/services/components/ServiceForm";
import ServiceList from "../../features/services/components/ServiceList";
import ServicesFilterPanel from "../../features/services/components/ServicesFilterPanel";
import ServiceTemplateGallery from "../../features/services/components/ServiceTemplateGallery";
import ServicesUnifiedAgenda from "../../features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";

const formatCurrency = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const formatNumber = new Intl.NumberFormat("es-CL");

export default function ServicesOverviewContent() {
  const overview = useServicesOverview();
  const {
    canManage,
    services,
    filteredServices,
    summaryTotals,
    collectionRate,
    unifiedAgendaItems,
    globalError,
    loadingList,
    loadingDetail,
    aggregatedLoading,
    aggregatedError,
    selectedService,
    schedules,
    selectedId,
    setSelectedId,
    createOpen,
    createError,
    openCreateModal,
    closeCreateModal,
    selectedTemplate,
    applyTemplate,
    paymentSchedule,
    paymentForm,
    handlePaymentFieldChange,
    paymentError,
    processingPayment,
    filters,
    handleCreateService,
    handleRegenerate,
    openPaymentModal,
    closePaymentModal,
    handlePaymentSubmit,
    handleUnlink,
    handleFilterChange,
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,
  } = overview;

  return (
    <section className="flex flex-col gap-6">
      {globalError && <Alert variant="error">{globalError}</Alert>}

      <CollapsibleSection title="Resumen general" defaultOpen={false}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Servicios activos"
            value={`${formatNumber.format(summaryTotals.activeCount)} / ${formatNumber.format(filteredServices.length)}`}
            helper={`Vista filtrada: ${filteredServices.length} de ${services.length}`}
          />
          <MetricCard
            title="Monto esperado"
            value={formatCurrency.format(summaryTotals.totalExpected)}
            helper="Periodo actual"
          />
          <MetricCard
            title="Pagos conciliados"
            value={formatCurrency.format(summaryTotals.totalPaid)}
            helper={`Cobertura ${collectionRate ? `${Math.round(collectionRate * 100)}%` : "0%"}`}
          />
          <MetricCard
            title="Pendientes / vencidos"
            value={`${formatNumber.format(summaryTotals.pendingCount)} / ${formatNumber.format(summaryTotals.overdueCount)}`}
            helper="Cuotas con seguimiento"
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Filtros" defaultOpen={false}>
        <ServicesFilterPanel services={services} filters={filters} onChange={handleFilterChange} />
      </CollapsibleSection>

      <CollapsibleSection title="Plantillas" defaultOpen={false}>
        <ServiceTemplateGallery onApply={applyTemplate} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Servicios registrados"
        defaultOpen={false}
        description="Selecciona un servicio para ver su cronograma y acciones disponibles"
        actions={
          canManage && (
            <Button variant="primary" onClick={openCreateModal}>
              Nuevo servicio
            </Button>
          )
        }
      >
        {loadingList && <p className="text-xs text-slate-400">Actualizando listado de servicios...</p>}
        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <div className="h-full">
            <ServiceList
              services={filteredServices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreateRequest={openCreateModal}
              canManage={canManage}
            />
          </div>
          <div className="h-full">
            <ServiceDetail
              service={selectedService}
              schedules={schedules}
              loading={loadingDetail}
              canManage={canManage}
              onRegenerate={handleRegenerate}
              onRegisterPayment={openPaymentModal}
              onUnlinkPayment={handleUnlink}
            />
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Agenda unificada"
        defaultOpen={false}
        description="Pagos programados consolidados por fecha de vencimiento"
      >
        <ServicesUnifiedAgenda
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          error={aggregatedError}
          canManage={canManage}
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
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

      <Modal
        isOpen={Boolean(paymentSchedule)}
        onClose={closePaymentModal}
        title={
          paymentSchedule
            ? `Registrar pago ${dayjs(paymentSchedule.period_start).format("MMM YYYY")}`
            : "Registrar pago"
        }
      >
        {paymentSchedule && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <Input
              label="ID transacción"
              type="number"
              value={paymentForm.transactionId}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handlePaymentFieldChange("transactionId", event)
              }
              required
            />
            <Input
              label="Monto pagado"
              type="number"
              value={paymentForm.paidAmount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handlePaymentFieldChange("paidAmount", event)
              }
              min={0}
              step="0.01"
              required
            />
            <Input
              label="Fecha de pago"
              type="date"
              value={paymentForm.paidDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handlePaymentFieldChange("paidDate", event)
              }
              required
            />
            <Input
              label="Nota"
              type="textarea"
              rows={2}
              value={paymentForm.note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                handlePaymentFieldChange("note", event)
              }
            />
            {paymentError && <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{paymentError}</p>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closePaymentModal} disabled={processingPayment}>
                Cancelar
              </Button>
              <Button type="submit" disabled={processingPayment}>
                {processingPayment ? "Registrando..." : "Registrar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
};

function MetricCard({ title, value, helper }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-white/45 bg-base-100/70 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </article>
  );
}
