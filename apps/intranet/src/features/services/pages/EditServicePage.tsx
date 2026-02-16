import { Alert, Button, Description, Surface } from "@heroui/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import {
  fetchServiceDetail,
  regenerateServiceSchedules,
  updateService,
} from "@/features/services/api";
import { EditScheduleModal } from "@/features/services/components/EditScheduleModal";
import { ServiceForm } from "@/features/services/components/ServiceForm";
import { ServiceScheduleAccordion } from "@/features/services/components/ServiceScheduleAccordion";
import { ServiceScheduleTable } from "@/features/services/components/ServiceScheduleTable";
import { SkipScheduleModal } from "@/features/services/components/SkipScheduleModal";
import { servicesActions, servicesStore } from "@/features/services/store";
import type { CreateServicePayload, ServiceDetailResponse } from "@/features/services/types";
import { fmtCLP } from "@/lib/format";
export function ServiceEditPage() {
  const { id } = useParams({ from: "/_authed/services/$id/edit" });
  const navigate = useNavigate({ from: "/services/$id/edit" });
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<null | string>(null);
  const { editScheduleOpen, editScheduleTarget, skipScheduleOpen, skipScheduleTarget } =
    useStore(servicesStore);

  // Keep fetchServiceDetail as it provides aggregated data with schedules
  const { data: detail } = useSuspenseQuery({
    queryFn: () => {
      if (!id) {
        throw new Error("ID de servicio no proporcionado");
      }
      return fetchServiceDetail(id);
    },
    queryKey: ["service-detail", id],
  });

  // Use REST API mutation for service updates (ZenStack has strict Decimal type requirements)
  const updateMutation = useMutation({
    mutationFn: (payload: CreateServicePayload) => updateService(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["service-detail", id] });
      void queryClient.invalidateQueries({ queryKey: ["services-audit"] });
    },
  });

  const handleRegenerate = async (
    serviceId: string,
    payload?: { months?: number; startDate?: Date },
  ) => {
    try {
      const updated = await regenerateServiceSchedules(serviceId, payload ?? {});
      queryClient.setQueryData(["service-detail", id], updated);
      setSaveMessage("Proyecciones regeneradas correctamente.");
    } catch (error_) {
      console.error("Regenerate failed:", error_);
    }
  };

  const updateError = (() => {
    if (updateMutation.error instanceof Error) {
      return updateMutation.error.message;
    }
    if (updateMutation.error) {
      return String(updateMutation.error);
    }
    return null;
  })();

  const displayError = updateError;

  const handleSubmit = async (payload: CreateServicePayload) => {
    setSaveMessage(null);
    if (!id) {
      return;
    }

    try {
      await updateMutation.mutateAsync(payload);
      setSaveMessage("Servicio actualizado correctamente.");
    } catch {
      // Error handled by mutation state
    }
  };
  const summaryCards = useMemo(() => {
    const { service } = detail;
    return [
      {
        helper: "Monto base configurado",
        label: "Monto mensual",
        value: fmtCLP(service.defaultAmount),
      },
      {
        helper: "Cuotas sin pago registrado",
        label: "Pendientes",
        value: `${service.pendingCount}`,
      },
      {
        helper: "Total conciliado a la fecha",
        label: "Pagado",
        value: fmtCLP(service.totalPaid),
      },
      {
        helper: "Registro en base de datos",
        label: "Última actualización",
        value: dayjs(service.updatedAt).format("DD MMM YYYY HH:mm"),
      },
    ];
  }, [detail]);

  const historyItems = useMemo(() => {
    const { service } = detail;
    const items: { date: string; description?: string; title: string }[] = [
      {
        date: dayjs(service.createdAt).format("DD MMM YYYY HH:mm"),
        description: "Servicio registrado en la plataforma",
        title: "Creación",
      },
      {
        date: dayjs(service.updatedAt).format("DD MMM YYYY HH:mm"),
        description: "Datos del servicio actualizados",
        title: "Última modificación",
      },
    ];

    if (service.overdueCount > 0) {
      items.push({
        date: dayjs().format("DD MMM YYYY"),
        description: `${service.overdueCount} cuotas requieren revisión`,
        title: "Cuotas vencidas",
      });
    }
    return items;
  }, [detail]);

  const initialValues = detail ? mapServiceToForm(detail.service) : undefined;

  const service = detail.service;
  const schedules = detail.schedules;

  return (
    <section className="space-y-6">
      {displayError && <Alert status="danger">{displayError}</Alert>}
      {saveMessage && <Alert status="success">{saveMessage}</Alert>}

      <Surface className="space-y-6 rounded-[28px] p-6 shadow-inner">
        <div className="flex justify-end">
          <Button
            onClick={() => {
              void navigate({ to: "/services" });
            }}
            variant="ghost"
          >
            Volver
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
          <aside className="space-y-4 rounded-2xl border border-default-200/60 bg-background/80 p-4 text-foreground text-sm shadow-inner">
            <span className="font-semibold text-default-700 text-sm uppercase tracking-wide">
              Resumen
            </span>
            <div className="space-y-3">
              {summaryCards.map((card) => (
                <div
                  className="rounded-2xl border border-default-200 bg-default-50 p-3"
                  key={card.label}
                >
                  <span className="block font-semibold text-default-700 text-xs uppercase tracking-wide">
                    {card.label}
                  </span>
                  <span className="mt-1 block font-semibold text-foreground text-lg">
                    {card.value}
                  </span>
                  {card.helper && (
                    <Description className="text-default-400 text-xs">{card.helper}</Description>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <span className="font-semibold text-default-700 text-xs uppercase tracking-wide">
                Historial
              </span>
              <ol className="space-y-2 text-default-500 text-xs">
                {historyItems.map((item) => (
                  <li
                    className="rounded-xl border border-default-200 bg-default-50 p-3"
                    key={item.title}
                  >
                    <span className="block font-semibold text-foreground">{item.title}</span>
                    {item.description && (
                      <Description className="text-default-400 text-xs">
                        {item.description}
                      </Description>
                    )}
                    <Description className="text-default-300 text-xs uppercase tracking-wide">
                      {item.date}
                    </Description>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="rounded-2xl border border-default-200 bg-background p-6 shadow-sm">
              <span className="font-semibold text-default-700 text-sm uppercase tracking-wide">
                Datos generales
              </span>
              {initialValues && (
                <ServiceForm
                  initialValues={initialValues}
                  onCancel={() => {
                    void navigate({ to: "/services" });
                  }}
                  onSubmit={handleSubmit}
                  submitLabel="Actualizar servicio"
                />
              )}
            </section>

            <section className="space-y-4">
              <ServiceScheduleAccordion
                canManage={false}
                onRegisterPayment={() => undefined}
                onUnlinkPayment={() => undefined}
                schedules={schedules}
                service={service}
              />

              <ServiceScheduleTable
                canManage={false}
                onEditSchedule={(schedule) => servicesActions.openEditScheduleModal(schedule)}
                onRegisterPayment={() => undefined}
                onSkipSchedule={(schedule) => servicesActions.openSkipScheduleModal(schedule)}
                onUnlinkPayment={() => undefined}
                schedules={schedules}
              />

              <div className="flex justify-end">
                <Button
                  isDisabled={updateMutation.isPending}
                  onPress={() => handleRegenerate(String(service.id))}
                  variant="secondary"
                >
                  Regenerar cronograma
                </Button>
              </div>
            </section>
          </div>
        </div>
      </Surface>

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

function mapServiceToForm(
  service: ServiceDetailResponse["service"],
): Partial<CreateServicePayload> {
  return {
    accountReference: service.accountReference ?? undefined,
    amountIndexation: service.amountIndexation,
    category: service.category ?? undefined,
    counterpartAccountId: service.counterpartAccountId,
    counterpartId: service.counterpartId,
    defaultAmount: service.defaultAmount,
    detail: service.detail ?? undefined,
    dueDay: service.dueDay,
    emissionDay: service.emissionDay,
    emissionEndDay: service.emissionEndDay,
    emissionExactDate: service.emissionExactDate ?? undefined,
    emissionMode: service.emissionMode,
    emissionStartDay: service.emissionStartDay,
    frequency: service.frequency,
    lateFeeGraceDays: service.lateFeeGraceDays ?? undefined,
    lateFeeMode: service.lateFeeMode,
    lateFeeValue: service.lateFeeValue ?? undefined,
    monthsToGenerate: service.nextGenerationMonths,
    name: service.name,
    notes: service.notes ?? undefined,
    obligationType: service.obligationType,
    ownership: service.ownership,
    recurrenceType: service.recurrenceType,
    serviceType: service.serviceType,
    startDate: service.startDate,
  };
}
