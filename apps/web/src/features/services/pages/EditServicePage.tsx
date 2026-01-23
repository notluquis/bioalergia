import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import {
  fetchServiceDetail,
  regenerateServiceSchedules,
  updateService,
} from "@/features/services/api";
import ServiceForm from "@/features/services/components/ServiceForm";
import ServiceScheduleAccordion from "@/features/services/components/ServiceScheduleAccordion";
import ServiceScheduleTable from "@/features/services/components/ServiceScheduleTable";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import type { CreateServicePayload, ServiceDetailResponse } from "@/features/services/types";
import { fmtCLP } from "@/lib/format";

export default function ServiceEditPage() {
  const { id } = useParams({ from: "/_authed/services/$id/edit" });
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<null | string>(null);

  // Keep fetchServiceDetail as it provides aggregated data with schedules
  // Keep fetchServiceDetail as it provides aggregated data with schedules
  const { data: detail } = useSuspenseQuery({
    queryFn: () => {
      if (!id) throw new Error("ID de servicio no proporcionado");
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
    payload?: { months?: number; startDate?: string },
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
    if (updateMutation.error instanceof Error) return updateMutation.error.message;
    if (updateMutation.error) return String(updateMutation.error);
    return null;
  })();

  const displayError = updateError;

  const handleSubmit = async (payload: CreateServicePayload) => {
    setSaveMessage(null);
    if (!id) return;

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
        value: fmtCLP(service.default_amount),
      },
      {
        helper: "Cuotas sin pago registrado",
        label: "Pendientes",
        value: `${service.pending_count}`,
      },
      {
        helper: "Total conciliado a la fecha",
        label: "Pagado",
        value: fmtCLP(service.total_paid),
      },
      {
        helper: "Registro en base de datos",
        label: "Última actualización",
        value: dayjs(service.updated_at).format("DD MMM YYYY HH:mm"),
      },
    ];
  }, [detail]);

  const historyItems = useMemo(() => {
    const { service } = detail;
    const items: { date: string; description?: string; title: string }[] = [
      {
        date: dayjs(service.created_at).format("DD MMM YYYY HH:mm"),
        description: "Servicio registrado en la plataforma",
        title: "Creación",
      },
      {
        date: dayjs(service.updated_at).format("DD MMM YYYY HH:mm"),
        description: "Datos del servicio actualizados",
        title: "Última modificación",
      },
    ];
    if (service.overdue_count > 0) {
      items.push({
        date: dayjs().format("DD MMM YYYY"),
        description: `${service.overdue_count} cuotas requieren revisión`,
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
      <ServicesHero
        actions={
          <Button
            onClick={() => {
              globalThis.history.back();
            }}
            variant="ghost"
          >
            Volver
          </Button>
        }
        description={
          service ? service.name : "Ajusta los datos y cronogramas del servicio seleccionado."
        }
        title="Editar servicio"
      />

      {displayError && <Alert variant="error">{displayError}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      <ServicesSurface className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
          <aside className="border-base-300/60 bg-base-100/80 text-base-content space-y-4 rounded-2xl border p-4 text-sm shadow-inner">
            <h2 className="text-base-content/80 text-sm font-semibold tracking-wide uppercase">
              Resumen
            </h2>
            <div className="space-y-3">
              {summaryCards.map((card) => (
                <div
                  className="border-base-300 bg-base-200 rounded-2xl border p-3"
                  key={card.label}
                >
                  <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
                    {card.label}
                  </p>
                  <p className="text-base-content mt-1 text-lg font-semibold">{card.value}</p>
                  {card.helper && <p className="text-base-content/50 text-xs">{card.helper}</p>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">
                Historial
              </h3>
              <ol className="text-base-content/60 space-y-2 text-xs">
                {historyItems.map((item) => (
                  <li
                    className="border-base-300 bg-base-200 rounded-xl border p-3"
                    key={item.title}
                  >
                    <p className="text-base-content font-semibold">{item.title}</p>
                    {item.description && (
                      <p className="text-base-content/50 text-xs">{item.description}</p>
                    )}
                    <p className="text-base-content/40 text-xs tracking-wide uppercase">
                      {item.date}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
              <h2 className="text-base-content/80 text-sm font-semibold tracking-wide uppercase">
                Datos generales
              </h2>
              {initialValues && (
                <ServiceForm
                  initialValues={initialValues}
                  onCancel={() => {
                    globalThis.history.back();
                  }}
                  onSubmit={handleSubmit}
                  submitLabel="Actualizar servicio"
                />
              )}
            </section>

            <section className="space-y-4">
              <ServiceScheduleAccordion
                canManage={false}
                onRegisterPayment={() => {}}
                onUnlinkPayment={() => {}}
                schedules={schedules}
                service={service}
              />
              <ServiceScheduleTable
                canManage={false}
                onRegisterPayment={() => {}}
                onUnlinkPayment={() => {}}
                schedules={schedules}
              />
              <div className="flex justify-end">
                <Button
                  disabled={updateMutation.isPending}
                  onClick={() => handleRegenerate(String(service.id))}
                  variant="secondary"
                >
                  Regenerar cronograma
                </Button>
              </div>
            </section>
          </div>
        </div>
      </ServicesSurface>
    </section>
  );
}

function mapServiceToForm(
  service: ServiceDetailResponse["service"],
): Partial<CreateServicePayload> {
  return {
    accountReference: service.account_reference ?? undefined,
    amountIndexation: service.amount_indexation,
    category: service.category ?? undefined,
    counterpartAccountId: service.counterpart_account_id,
    counterpartId: service.counterpart_id,
    defaultAmount: service.default_amount,
    detail: service.detail ?? undefined,
    dueDay: service.due_day,
    emissionDay: service.emission_day,
    emissionEndDay: service.emission_end_day,
    emissionExactDate: service.emission_exact_date ?? undefined,
    emissionMode: service.emission_mode,
    emissionStartDay: service.emission_start_day,
    frequency: service.frequency,
    lateFeeGraceDays: service.late_fee_grace_days ?? undefined,
    lateFeeMode: service.late_fee_mode,
    lateFeeValue: service.late_fee_value ?? undefined,
    monthsToGenerate: service.next_generation_months,
    name: service.name,
    notes: service.notes ?? undefined,
    obligationType: service.obligation_type,
    ownership: service.ownership,
    recurrenceType: service.recurrence_type,
    serviceType: service.service_type,
    startDate: service.start_date,
  };
}
