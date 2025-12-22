import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LOADING_SPINNER_MD } from "@/lib/styles";
import { fmtCLP } from "@/lib/format";
import { ServicesHero, ServicesSurface } from "@/features/services/components/ServicesShell";
import ServiceForm from "@/features/services/components/ServiceForm";
import ServiceScheduleAccordion from "@/features/services/components/ServiceScheduleAccordion";
import ServiceScheduleTable from "@/features/services/components/ServiceScheduleTable";
import {
  fetchServiceDetail,
  updateService as updateServiceRequest,
  regenerateServiceSchedules,
} from "@/features/services/api";
import type { CreateServicePayload, ServiceDetailResponse } from "@/features/services/types";

function mapServiceToForm(service: ServiceDetailResponse["service"]): Partial<CreateServicePayload> {
  return {
    name: service.name,
    detail: service.detail ?? undefined,
    category: service.category ?? undefined,
    serviceType: service.service_type,
    ownership: service.ownership,
    obligationType: service.obligation_type,
    recurrenceType: service.recurrence_type,
    frequency: service.frequency,
    defaultAmount: service.default_amount,
    amountIndexation: service.amount_indexation,
    counterpartId: service.counterpart_id,
    counterpartAccountId: service.counterpart_account_id,
    accountReference: service.account_reference ?? undefined,
    emissionMode: service.emission_mode,
    emissionDay: service.emission_day,
    emissionStartDay: service.emission_start_day,
    emissionEndDay: service.emission_end_day,
    emissionExactDate: service.emission_exact_date ?? undefined,
    dueDay: service.due_day,
    startDate: service.start_date,
    monthsToGenerate: service.next_generation_months,
    lateFeeMode: service.late_fee_mode,
    lateFeeValue: service.late_fee_value ?? undefined,
    lateFeeGraceDays: service.late_fee_grace_days ?? undefined,
    notes: service.notes ?? undefined,
  };
}

export default function ServiceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const {
    data: detail,
    isLoading: loading,
    error: fetchError,
  } = useQuery({
    queryKey: ["service-detail", id],
    queryFn: () => {
      if (!id) throw new Error("ID de servicio no proporcionado");
      return fetchServiceDetail(id);
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CreateServicePayload) => {
      if (!id) throw new Error("ID requerido");
      return updateServiceRequest(id, payload);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["service-detail", id], updated);
      queryClient.invalidateQueries({ queryKey: ["services-audit"] });
      setSaveMessage("Servicio actualizado correctamente.");
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: async ({ id, payload = {} }: { id: string; payload?: { months?: number; startDate?: string } }) => {
      return regenerateServiceSchedules(id, payload);
    },
    onSuccess: (updated) => {
      if (id) queryClient.setQueryData(["service-detail", id], updated);
      setSaveMessage("Proyecciones regeneradas correctamente.");
    },
  });

  const error = fetchError instanceof Error ? fetchError.message : fetchError ? String(fetchError) : null;
  const updateError =
    updateMutation.error instanceof Error
      ? updateMutation.error.message
      : updateMutation.error
        ? String(updateMutation.error)
        : null;
  const regenerateError =
    regenerateMutation.error instanceof Error
      ? regenerateMutation.error.message
      : regenerateMutation.error
        ? String(regenerateMutation.error)
        : null;

  const displayError = error || updateError || regenerateError;

  const initialValues = useMemo(() => (detail ? mapServiceToForm(detail.service) : undefined), [detail]);

  const handleSubmit = async (payload: CreateServicePayload) => {
    setSaveMessage(null);
    await updateMutation.mutateAsync(payload);
  };

  const summaryCards = useMemo(() => {
    if (!detail) return [] as Array<{ label: string; value: string; helper?: string }>;
    const { service } = detail;
    return [
      {
        label: "Monto mensual",
        value: fmtCLP(service.default_amount),
        helper: "Monto base configurado",
      },
      {
        label: "Pendientes",
        value: `${service.pending_count}`,
        helper: "Cuotas sin pago registrado",
      },
      {
        label: "Pagado",
        value: fmtCLP(service.total_paid),
        helper: "Total conciliado a la fecha",
      },
      {
        label: "Última actualización",
        value: dayjs(service.updated_at).format("DD MMM YYYY HH:mm"),
        helper: "Registro en base de datos",
      },
    ];
  }, [detail]);

  const historyItems = useMemo(() => {
    if (!detail) return [] as Array<{ title: string; description?: string; date: string }>;
    const { service } = detail;
    const items: Array<{ title: string; description?: string; date: string }> = [
      {
        title: "Creación",
        description: "Servicio registrado en la plataforma",
        date: dayjs(service.created_at).format("DD MMM YYYY HH:mm"),
      },
      {
        title: "Última modificación",
        description: "Datos del servicio actualizados",
        date: dayjs(service.updated_at).format("DD MMM YYYY HH:mm"),
      },
    ];
    if (service.overdue_count > 0) {
      items.push({
        title: "Cuotas vencidas",
        description: `${service.overdue_count} cuotas requieren revisión`,
        date: dayjs().format("DD MMM YYYY"),
      });
    }
    return items;
  }, [detail]);

  if (!id) {
    return <Alert variant="error">Identificador de servicio no válido.</Alert>;
  }

  const isInitialLoading = loading && !detail;

  if (isInitialLoading) {
    return (
      <section className="space-y-6">
        <ServicesHero
          title="Editar servicio"
          description="Cargando información del servicio seleccionado."
          breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Editar" }]}
          actions={
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Volver
            </Button>
          }
        />

        <ServicesSurface className="flex min-h-65 items-center justify-center">
          <div className="text-base-content/70 flex items-center gap-3 text-sm">
            <span className={LOADING_SPINNER_MD} aria-hidden="true" />
            <span>Preparando datos del servicio...</span>
          </div>
        </ServicesSurface>
      </section>
    );
  }

  if (displayError && !detail) {
    return <Alert variant="error">{displayError}</Alert>;
  }

  const service = detail?.service ?? null;
  const schedules = detail?.schedules ?? [];

  return (
    <section className="space-y-6">
      <ServicesHero
        title="Editar servicio"
        description={service ? service.name : "Ajusta los datos y cronogramas del servicio seleccionado."}
        breadcrumbs={[{ label: "Servicios", to: "/services" }, { label: "Editar" }]}
        actions={
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Volver
          </Button>
        }
      />

      {displayError && <Alert variant="error">{displayError}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      {service && (
        <ServicesSurface className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)] lg:items-start">
            <aside className="border-base-300/60 bg-base-100/80 text-base-content space-y-4 rounded-2xl border p-4 text-sm shadow-inner">
              <h2 className="text-base-content/80 text-sm font-semibold tracking-wide uppercase">Resumen</h2>
              <div className="space-y-3">
                {summaryCards.map((card) => (
                  <div key={card.label} className="border-base-300 bg-base-200 rounded-2xl border p-3">
                    <p className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">{card.label}</p>
                    <p className="text-base-content mt-1 text-lg font-semibold">{card.value}</p>
                    {card.helper && <p className="text-base-content/50 text-xs">{card.helper}</p>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="text-base-content/80 text-xs font-semibold tracking-wide uppercase">Historial</h3>
                <ol className="text-base-content/60 space-y-2 text-xs">
                  {historyItems.map((item) => (
                    <li key={item.title} className="border-base-300 bg-base-200 rounded-xl border p-3">
                      <p className="text-base-content font-semibold">{item.title}</p>
                      {item.description && <p className="text-base-content/50 text-xs">{item.description}</p>}
                      <p className="text-base-content/40 text-xs tracking-wide uppercase">{item.date}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>

            <div className="space-y-6">
              <section className="border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
                <h2 className="text-base-content/80 text-sm font-semibold tracking-wide uppercase">Datos generales</h2>
                {initialValues && (
                  <ServiceForm
                    onSubmit={handleSubmit}
                    onCancel={() => navigate(-1)}
                    initialValues={initialValues}
                    submitLabel="Actualizar servicio"
                  />
                )}
              </section>

              <section className="space-y-4">
                <ServiceScheduleAccordion
                  service={service}
                  schedules={schedules}
                  canManage={false}
                  onRegisterPayment={() => undefined}
                  onUnlinkPayment={() => undefined}
                />
                <ServiceScheduleTable
                  schedules={schedules}
                  canManage={false}
                  onRegisterPayment={() => undefined}
                  onUnlinkPayment={() => undefined}
                />
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => regenerateMutation.mutate({ id: String(service.id) })}
                    disabled={regenerateMutation.isPending}
                  >
                    {regenerateMutation.isPending ? "Regenerando..." : "Regenerar cronograma"}
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </ServicesSurface>
      )}
    </section>
  );
}
