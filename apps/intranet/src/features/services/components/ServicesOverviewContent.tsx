import {
  Alert,
  Button,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { EditScheduleModal } from "@/features/services/components/EditScheduleModal";
import { ServiceDetail } from "@/features/services/components/ServiceDetail";
import { ServiceForm } from "@/features/services/components/ServiceForm";
import { ServiceList } from "@/features/services/components/ServiceList";
import { ServicesFilterPanel } from "@/features/services/components/ServicesFilterPanel";
import { SkipScheduleModal } from "@/features/services/components/SkipScheduleModal";
import { useServicesOverview } from "@/features/services/hooks/use-services-overview";
import { servicesActions, servicesStore } from "@/features/services/store";
import { currencyFormatter, numberFormatter } from "@/lib/format";
import { CARD_COMPACT, TITLE_MD } from "@/lib/styles";
export function ServicesOverviewContent() {
  const overview = useServicesOverview();
  const { editScheduleOpen, editScheduleTarget, skipScheduleOpen, skipScheduleTarget } =
    useStore(servicesStore);

  const {
    canManage,
    closeCreateModal,
    closePaymentModal,
    collectionRate,
    createError,
    createOpen,
    filteredServices,
    filters,
    globalError,
    handleCreateService,
    handleEditSchedule,
    handleFilterChange,
    handlePaymentFieldChange,
    handlePaymentSubmit,
    handleRegenerate,
    handleSkipSchedule,
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

  return (
    <section className="space-y-4">
      {globalError && <Alert status="danger">{globalError}</Alert>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className={TITLE_MD}>Resumen de servicios</span>
        {canManage && (
          <Button onPress={() => openCreateModal()} size="sm" variant="primary">
            Nuevo servicio
          </Button>
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
          onEditSchedule={(schedule) => handleEditSchedule(selectedService.publicId, schedule)}
          onRegenerate={handleRegenerate}
          onRegisterPayment={openPaymentModal}
          onSkipSchedule={(schedule) => handleSkipSchedule(selectedService.publicId, schedule)}
          onUnlinkPayment={handleUnlink}
          schedules={schedules}
          service={selectedService}
        />
      )}

      <Modal.Backdrop isOpen={createOpen} onOpenChange={(open) => !open && closeCreateModal()}>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Nuevo servicio</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
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
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop
        isOpen={Boolean(paymentSchedule)}
        onOpenChange={(open) => !open && closePaymentModal()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-125">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {paymentSchedule
                  ? `Registrar pago ${dayjs(paymentSchedule.periodStart).format("MMM YYYY")}`
                  : "Registrar pago"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {paymentSchedule && (
                <form className="space-y-4" onSubmit={handlePaymentSubmit}>
                  <TextField isRequired name="transactionId">
                    <Label>ID transacción</Label>
                    <Input
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        handlePaymentFieldChange("transactionId", event.target.value);
                      }}
                      type="number"
                      value={paymentForm.transactionId}
                    />
                    <FieldError />
                  </TextField>

                  <TextField isRequired name="paidAmount">
                    <Label>Monto pagado</Label>
                    <Input
                      min={0}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        handlePaymentFieldChange("paidAmount", event.target.value);
                      }}
                      step="0.01"
                      type="number"
                      value={paymentForm.paidAmount}
                    />
                    <FieldError />
                  </TextField>

                  <TextField isRequired name="paidDate">
                    <Label>Fecha de pago</Label>
                    <Input
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        handlePaymentFieldChange("paidDate", event.target.value);
                      }}
                      type="date"
                      value={dayjs(paymentForm.paidDate).format("YYYY-MM-DD")}
                    />
                    <FieldError />
                  </TextField>

                  <TextField name="note">
                    <Label>Nota</Label>
                    <textarea
                      className="w-full rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm text-foreground placeholder-default-400 focus:border-primary focus:outline-none"
                      name="note"
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                        handlePaymentFieldChange("note", event.target.value);
                      }}
                      rows={2}
                      value={paymentForm.note}
                    />
                  </TextField>

                  {paymentError && (
                    <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
                      {paymentError}
                    </Description>
                  )}
                  <div className="flex justify-end gap-3">
                    <Button
                      isDisabled={processingPayment}
                      slot="close"
                      type="button"
                      variant="secondary"
                    >
                      Cancelar
                    </Button>
                    <Button isDisabled={processingPayment} type="submit">
                      {processingPayment ? "Registrando..." : "Registrar pago"}
                    </Button>
                  </div>
                </form>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <EditScheduleModal
        isOpen={editScheduleOpen}
        onClose={servicesActions.closeEditScheduleModal}
        schedule={editScheduleTarget}
      />

      <SkipScheduleModal
        isOpen={skipScheduleOpen}
        onClose={servicesActions.closeSkipScheduleModal}
        schedule={skipScheduleTarget}
      />
    </section>
  );
}
