import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { LOADING_SPINNER_MD } from "@/lib/styles";
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
  const [detail, setDetail] = useState<ServiceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchServiceDetail(id)
      .then((response) => {
        if (!cancelled) setDetail(response);
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No se pudo cargar el servicio";
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const initialValues = useMemo(() => (detail ? mapServiceToForm(detail.service) : undefined), [detail]);

  const handleSubmit = async (payload: CreateServicePayload) => {
    if (!id) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const response = await updateServiceRequest(id, payload);
      setDetail(response);
      setSaveMessage("Servicio actualizado correctamente.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el servicio";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async (schedulePayload: { months?: number; startDate?: string }) => {
    if (!detail) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const response = await regenerateServiceSchedules(detail.service.public_id, schedulePayload);
      setDetail(response);
      setSaveMessage("Cronograma regenerado correctamente.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo regenerar el cronograma";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = useMemo(() => {
    if (!detail) return [] as Array<{ label: string; value: string; helper?: string }>;
    const { service } = detail;
    return [
      {
        label: "Monto mensual",
        value: new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
          service.default_amount
        ),
        helper: "Monto base configurado",
      },
      {
        label: "Pendientes",
        value: `${service.pending_count}`,
        helper: "Cuotas sin pago registrado",
      },
      {
        label: "Pagado",
        value: new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
          service.total_paid
        ),
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

  if (error && !detail) {
    return <Alert variant="error">{error}</Alert>;
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

      {error && <Alert variant="error">{error}</Alert>}
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
                    onClick={() =>
                      handleRegenerate({ months: service.next_generation_months, startDate: service.start_date })
                    }
                    disabled={saving}
                  >
                    Regenerar cronograma
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
