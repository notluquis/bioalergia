import { Chip, Description, Spinner } from "@heroui/react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ServiceDetail } from "@/features/services/components/ServiceDetail";
import { ServiceForm } from "@/features/services/components/ServiceForm";
import { ServiceList } from "@/features/services/components/ServiceList";
import { ServicesFilterPanel } from "@/features/services/components/ServicesFilterPanel";
import { ServicesUnifiedAgenda } from "@/features/services/components/ServicesUnifiedAgenda";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { CARD_COMPACT, TITLE_MD } from "@/lib/styles";
export function ServicesOverviewContent() {
  const overview = useServicesOverview();
  const {
    aggregatedError,
    aggregatedLoading,
    canManage,
    closeCreateModal,
    closePaymentModal,
    collectionRate,
    createError,
    createOpen,
    filteredServices,
    filters,
    globalError,
    handleAgendaRegisterPayment,
    handleAgendaUnlinkPayment,
    handleCreateService,
    handleFilterChange,
    handlePaymentFieldChange,
    handlePaymentSubmit,
    handleRegenerate,
    handleUnlink,
    loadingDetail,
    loadingList,
    openCreateModal,
    openPaymentModal,
    paymentError,
    paymentForm,
    paymentSchedule,
    processingPayment,
    schedules,
    selectedId,
    selectedService,
    selectedTemplate,
    services,
    setSelectedId,
    summaryTotals,
    unifiedAgendaItems,
  } = overview;

  const stats = [
    {
      helper: `Vista filtrada: ${filteredServices.length} de ${services.length}`,
      title: "Servicios activos",
      value: `${numberFormatter.format(summaryTotals.activeCount)} / ${numberFormatter.format(filteredServices.length)}`,
    },
    {
      helper: "Periodo actual",
      title: "Monto esperado",
      value: currencyFormatter.format(summaryTotals.totalExpected),
    },
    {
      helper: (() => {
        const percentage = collectionRate ? Math.round(collectionRate * 100) : 0;
        return `Cobertura ${percentage}%`;
      })(),
      title: "Pagos conciliados",
      value: currencyFormatter.format(summaryTotals.totalPaid),
    },
    {
      helper: "Cuotas con seguimiento",
      title: "Pendientes / vencidos",
      value: `${numberFormatter.format(summaryTotals.pendingCount)} / ${numberFormatter.format(summaryTotals.overdueCount)}`,
    },
  ];

  const activeFiltersCount =
    (filters.search.trim() ? 1 : 0) + filters.statuses.size + filters.types.size;
  const showInitialLoading = aggregatedLoading && services.length === 0;

  if (showInitialLoading) {
    return (
      <div className="flex min-h-60 items-center justify-center">
        <div className="flex items-center gap-3 text-default-600 text-sm">
          <Spinner size="md" />
          <span>Cargando servicios...</span>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {globalError && <Alert status="danger">{globalError}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className={TITLE_MD}>Resumen de servicios</span>
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
              <div className="space-y-1" key={stat.title}>
                <span className="block font-medium text-default-500 text-xs uppercase">
                  {stat.title}
                </span>
                <span className="block font-bold text-lg text-primary">{stat.value}</span>
                {stat.helper && (
                  <Description className="text-default-400 text-xs">{stat.helper}</Description>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={CARD_COMPACT}>
        <div className="card-body">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground text-sm">Filtros</span>
            {activeFiltersCount > 0 && (
              <Chip color="accent" size="sm" variant="primary">
                {activeFiltersCount} activos
              </Chip>
            )}
          </div>
          <ServicesFilterPanel
            filters={filters}
            onChange={handleFilterChange}
            services={services}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-base text-foreground">
            Servicios{" "}
            {filteredServices.length !== services.length && `(${filteredServices.length})`}
          </span>
        </div>

        <ServiceList
          canManage={canManage}
          loading={loadingList}
          onCreateRequest={openCreateModal}
          onSelect={setSelectedId}
          selectedId={selectedId}
          services={filteredServices}
        />
      </div>

      {selectedService && (
        <ServiceDetail
          canManage={canManage}
          loading={loadingDetail}
          onRegenerate={handleRegenerate}
          onRegisterPayment={openPaymentModal}
          onUnlinkPayment={handleUnlink}
          schedules={schedules}
          service={selectedService}
        />
      )}

      <div className={CARD_COMPACT}>
        <div className="card-body">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <span className="block font-semibold text-foreground text-sm">Agenda unificada</span>
              <Description className="text-default-500 text-xs">
                Próximos pagos programados
              </Description>
            </div>
            <Link to="/services/agenda">
              <Button size="sm" variant="ghost">
                Ver todo
              </Button>
            </Link>
          </div>
          <ServicesUnifiedAgenda
            canManage={canManage}
            error={aggregatedError}
            items={unifiedAgendaItems}
            loading={aggregatedLoading}
            onRegisterPayment={handleAgendaRegisterPayment}
            onUnlinkPayment={handleAgendaUnlinkPayment}
          />
        </div>
      </div>

      <Modal isOpen={createOpen} onClose={closeCreateModal} title="Nuevo servicio">
        <ServiceForm
          initialValues={selectedTemplate?.payload}
          onCancel={closeCreateModal}
          onSubmit={async (payload) => {
            await handleCreateService(payload);
          }}
          submitLabel="Crear servicio"
        />

        {createError && (
          <Description className="mt-4 rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
            {createError}
          </Description>
        )}
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
          <form className="space-y-4" onSubmit={handlePaymentSubmit}>
            <Input
              label="ID transacción"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                handlePaymentFieldChange("transactionId", event.target.value);
              }}
              required
              type="number"
              value={paymentForm.transactionId}
            />

            <Input
              label="Monto pagado"
              min={0}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                handlePaymentFieldChange("paidAmount", event.target.value);
              }}
              required
              step="0.01"
              type="number"
              value={paymentForm.paidAmount}
            />

            <Input
              label="Fecha de pago"
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                handlePaymentFieldChange("paidDate", event.target.value);
              }}
              required
              type="date"
              value={dayjs(paymentForm.paidDate).format("YYYY-MM-DD")}
            />

            <Input
              as="textarea"
              label="Nota"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                handlePaymentFieldChange("note", event.target.value);
              }}
              rows={2}
              value={paymentForm.note}
            />

            {paymentError && (
              <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
                {paymentError}
              </Description>
            )}
            <div className="flex justify-end gap-3">
              <Button
                disabled={processingPayment}
                onClick={closePaymentModal}
                type="button"
                variant="secondary"
              >
                Cancelar
              </Button>
              <Button disabled={processingPayment} type="submit">
                {processingPayment ? "Registrando..." : "Registrar pago"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
