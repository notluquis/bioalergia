import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import Alert from "../../components/Alert";
import Button from "../../components/Button";
import Input from "../../components/Input";
import Modal from "../../components/Modal";
import ServiceDetail from "../../features/services/components/ServiceDetail";
import ServiceForm from "../../features/services/components/ServiceForm";
import ServiceList from "../../features/services/components/ServiceList";
import ServicesFilterPanel from "../../features/services/components/ServicesFilterPanel";
import ServicesUnifiedAgenda from "../../features/services/components/ServicesUnifiedAgenda";
import {
  ServicesHero,
  ServicesSurface,
  ServicesStatCard,
  ServicesGrid,
} from "../../features/services/components/ServicesShell";
import { useServicesOverview } from "../../features/services/hooks/useServicesOverview";
import { Link } from "react-router-dom";

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
    paymentSchedule,
    paymentForm,
    handlePaymentFieldChange,
    paymentError,
    processingPayment,
    suggestedTransactions,
    suggestedLoading,
    suggestedError,
    applySuggestedTransaction,
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

  const stats = [
    {
      title: "Servicios activos",
      value: `${formatNumber.format(summaryTotals.activeCount)} / ${formatNumber.format(filteredServices.length)}`,
      helper: `Vista filtrada: ${filteredServices.length} de ${services.length}`,
    },
    {
      title: "Monto esperado",
      value: formatCurrency.format(summaryTotals.totalExpected),
      helper: "Periodo actual",
    },
    {
      title: "Pagos conciliados",
      value: formatCurrency.format(summaryTotals.totalPaid),
      helper: `Cobertura ${collectionRate ? `${Math.round(collectionRate * 100)}%` : "0%"}`,
    },
    {
      title: "Pendientes / vencidos",
      value: `${formatNumber.format(summaryTotals.pendingCount)} / ${formatNumber.format(summaryTotals.overdueCount)}`,
      helper: "Cuotas con seguimiento",
    },
  ];

  const activeFiltersCount = (filters.search.trim() ? 1 : 0) + filters.statuses.size + filters.types.size;
  const showInitialLoading = aggregatedLoading && services.length === 0;

  if (showInitialLoading) {
    return (
      <section className="space-y-8">
        <ServicesHero title="Servicios recurrentes" description="Cargando datos de servicios y cronogramas..." />
        <ServicesSurface className="flex min-h-80 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
            <span>Preparando panel de servicios...</span>
          </div>
        </ServicesSurface>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      {globalError && <Alert variant="error">{globalError}</Alert>}

      <ServicesHero
        title="Servicios recurrentes"
        description="Supervisa tus servicios, cronogramas y pagos pendientes con una vista única optimizada para la operación diaria."
        actions={
          <>
            {activeFiltersCount > 0 && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {activeFiltersCount} filtros activos
              </span>
            )}
            <Link to="/services/templates">
              <Button variant="ghost">Plantillas</Button>
            </Link>
            {canManage && (
              <Button variant="primary" onClick={openCreateModal}>
                Nuevo servicio
              </Button>
            )}
          </>
        }
      />

      <ServicesSurface>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <ServicesStatCard key={stat.title} label={stat.title} value={stat.value} helper={stat.helper} />
          ))}
        </div>

        <div className="rounded-2xl border border-base-300/60 bg-base-100/70 p-5 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-base-content">Filtros inteligentes</p>
              <p className="text-xs text-base-content/60">
                Aplica criterios combinados para acotar la lista antes de seleccionar un servicio.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => handleFilterChange(filters)}>
              Refrescar filtros
            </Button>
          </div>
          <div className="mt-4">
            <ServicesFilterPanel services={services} filters={filters} onChange={handleFilterChange} />
          </div>
        </div>

        <ServicesGrid>
          <div className="space-y-6">
            <ServiceList
              services={filteredServices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onCreateRequest={openCreateModal}
              canManage={canManage}
              loading={loadingList}
            />
            <div className="rounded-2xl border border-base-300/60 bg-base-200/70 p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-base-content">Plantillas guardadas</p>
                  <p className="text-xs text-base-content/60">
                    Aplica una configuración predefinida para acelerar la carga.
                  </p>
                </div>
                <Link to="/services/templates">
                  <Button variant="ghost" size="sm">
                    Ver plantillas
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="space-y-6">
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
        </ServicesGrid>
      </ServicesSurface>

      <ServicesSurface>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-base-content">Agenda unificada</p>
            <p className="text-xs text-base-content/60">Pagos programados consolidados por fecha de vencimiento.</p>
          </div>
          <Link to="/services/agenda">
            <Button variant="ghost" size="sm">
              Abrir agenda
            </Button>
          </Link>
        </div>
        <ServicesUnifiedAgenda
          items={unifiedAgendaItems}
          loading={aggregatedLoading}
          error={aggregatedError}
          canManage={canManage}
          onRegisterPayment={handleAgendaRegisterPayment}
          onUnlinkPayment={handleAgendaUnlinkPayment}
        />
      </ServicesSurface>

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
            <div className="rounded-2xl border border-base-300/60 bg-base-200/60 p-3 text-xs text-base-content/70">
              <p className="font-semibold text-base-content">Sugerencias por monto</p>
              {suggestedLoading && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="loading loading-spinner loading-xs text-primary" aria-hidden="true" />
                  <span>
                    Buscando movimientos cercanos a {formatCurrency.format(paymentSchedule.expected_amount)}...
                  </span>
                </div>
              )}
              {suggestedError && <p className="mt-2 text-error">{suggestedError}</p>}
              {!suggestedLoading && !suggestedError && suggestedTransactions.length === 0 && (
                <p className="mt-2">
                  No encontramos movimientos con ese monto en un rango cercano. Usa ID o ajusta manualmente.
                </p>
              )}
              {!suggestedLoading && suggestedTransactions.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {suggestedTransactions.map((tx) => (
                    <li
                      key={tx.id}
                      className="rounded-xl border border-base-300 bg-base-100/80 p-3 shadow-sm transition hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-base-content">
                            {formatCurrency.format(tx.amount ?? 0)}
                          </p>
                          <p className="text-xs text-base-content/50">
                            {dayjs(tx.timestamp).format("DD MMM YYYY")} · ID #{tx.id}
                          </p>
                          {tx.description && <p className="text-xs text-base-content/60">{tx.description}</p>}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => applySuggestedTransaction(tx)}
                        >
                          Usar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Input
              label="ID transacción"
              type="number"
              value={paymentForm.transactionId}
              onChange={(event: ChangeEvent<HTMLInputElement>) => handlePaymentFieldChange("transactionId", event)}
              required
            />
            <Input
              label="Monto pagado"
              type="number"
              value={paymentForm.paidAmount}
              onChange={(event: ChangeEvent<HTMLInputElement>) => handlePaymentFieldChange("paidAmount", event)}
              min={0}
              step="0.01"
              required
            />
            <Input
              label="Fecha de pago"
              type="date"
              value={paymentForm.paidDate}
              onChange={(event: ChangeEvent<HTMLInputElement>) => handlePaymentFieldChange("paidDate", event)}
              required
            />
            <Input
              label="Nota"
              type="textarea"
              rows={2}
              value={paymentForm.note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => handlePaymentFieldChange("note", event)}
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
