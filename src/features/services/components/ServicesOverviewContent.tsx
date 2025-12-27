import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import ServiceDetail from "@/features/services/components/ServiceDetail";
import ServiceForm from "@/features/services/components/ServiceForm";
import ServiceList from "@/features/services/components/ServiceList";
import ServicesFilterPanel from "@/features/services/components/ServicesFilterPanel";
import ServicesUnifiedAgenda from "@/features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "@/features/services/hooks/useServicesOverview";
import { Link } from "react-router-dom";
import { numberFormatter, currencyFormatter } from "@/lib/format";
import { CARD_COMPACT, TITLE_MD, LOADING_SPINNER_MD, LOADING_SPINNER_XS } from "@/lib/styles";

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
      value: `${numberFormatter.format(summaryTotals.activeCount)} / ${numberFormatter.format(filteredServices.length)}`,
      helper: `Vista filtrada: ${filteredServices.length} de ${services.length}`,
    },
    {
      title: "Monto esperado",
      value: currencyFormatter.format(summaryTotals.totalExpected),
      helper: "Periodo actual",
    },
    {
      title: "Pagos conciliados",
      value: currencyFormatter.format(summaryTotals.totalPaid),
      helper: `Cobertura ${collectionRate ? `${Math.round(collectionRate * 100)}%` : "0%"}`,
    },
    {
      title: "Pendientes / vencidos",
      value: `${numberFormatter.format(summaryTotals.pendingCount)} / ${numberFormatter.format(summaryTotals.overdueCount)}`,
      helper: "Cuotas con seguimiento",
    },
  ];

  const activeFiltersCount = (filters.search.trim() ? 1 : 0) + filters.statuses.size + filters.types.size;
  const showInitialLoading = aggregatedLoading && services.length === 0;

  if (showInitialLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <div className="text-base-content/70 flex items-center gap-3 text-sm">
          <span className={LOADING_SPINNER_MD} aria-hidden="true" />
          <span>Cargando servicios...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {globalError && <Alert variant="error">{globalError}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={TITLE_MD}>Resumen de servicios</h1>
        {canManage && (
          <Link to="/services/create">
            <Button size="sm" variant="primary">
              Nuevo servicio
            </Button>
          </Link>
        )}
      </div>

      <div className={CARD_COMPACT}>
        <div className="card-body">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.title} className="space-y-1">
                <p className="text-base-content/60 text-xs font-medium uppercase">{stat.title}</p>
                <p className="text-primary text-lg font-bold">{stat.value}</p>
                {stat.helper && <p className="text-base-content/50 text-xs">{stat.helper}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={CARD_COMPACT}>
        <div className="card-body">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-base-content text-sm font-semibold">Filtros</p>
            {activeFiltersCount > 0 && (
              <span className="badge badge-primary badge-sm">{activeFiltersCount} activos</span>
            )}
          </div>
          <ServicesFilterPanel services={services} filters={filters} onChange={handleFilterChange} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-base font-semibold">
            Servicios {filteredServices.length !== services.length && `(${filteredServices.length})`}
          </h2>
        </div>

        <ServiceList
          services={filteredServices}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreateRequest={openCreateModal}
          canManage={canManage}
          loading={loadingList}
        />
      </div>

      {selectedService && (
        <ServiceDetail
          service={selectedService}
          schedules={schedules}
          loading={loadingDetail}
          canManage={canManage}
          onRegenerate={handleRegenerate}
          onRegisterPayment={openPaymentModal}
          onUnlinkPayment={handleUnlink}
        />
      )}

      <div className={CARD_COMPACT}>
        <div className="card-body">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-base-content text-sm font-semibold">Agenda unificada</p>
              <p className="text-base-content/60 text-xs">Próximos pagos programados</p>
            </div>
            <Link to="/services/agenda">
              <Button variant="ghost" size="xs">
                Ver todo
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
        </div>
      </div>

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
            <div className="border-base-300/60 bg-base-200/60 text-base-content/70 rounded-2xl border p-3 text-xs">
              <p className="text-base-content font-semibold">Sugerencias por monto</p>
              {suggestedLoading && (
                <div className="mt-2 flex items-center gap-2">
                  <span className={LOADING_SPINNER_XS} aria-hidden="true" />
                  <span>
                    Buscando movimientos cercanos a {currencyFormatter.format(paymentSchedule.expected_amount)}...
                  </span>
                </div>
              )}
              {suggestedError && <p className="text-error mt-2">{suggestedError}</p>}
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
                      className="border-base-300 bg-base-100/80 hover:border-primary/40 rounded-xl border p-3 shadow-sm transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base-content text-sm font-semibold">
                            {currencyFormatter.format(tx.transactionAmount ?? 0)}
                          </p>
                          <p className="text-base-content/50 text-xs">
                            {dayjs(tx.transactionDate).format("DD MMM YYYY")} · ID #{tx.id}
                          </p>
                          {tx.description && <p className="text-base-content/60 text-xs">{tx.description}</p>}
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
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handlePaymentFieldChange("transactionId", event.target.value)
              }
              required
            />
            <Input
              label="Monto pagado"
              type="number"
              value={paymentForm.paidAmount}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                handlePaymentFieldChange("paidAmount", event.target.value)
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
                handlePaymentFieldChange("paidDate", event.target.value)
              }
              required
            />
            <Input
              label="Nota"
              as="textarea"
              rows={2}
              value={paymentForm.note}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                handlePaymentFieldChange("note", event.target.value)
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
