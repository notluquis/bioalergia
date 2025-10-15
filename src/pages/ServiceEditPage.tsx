import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import Button from "../components/Button";
import Alert from "../components/Alert";
import ServiceForm from "../features/services/components/ServiceForm";
import ServiceScheduleAccordion from "../features/services/components/ServiceScheduleAccordion";
import ServiceScheduleTable from "../features/services/components/ServiceScheduleTable";
import {
  fetchServiceDetail,
  updateService as updateServiceRequest,
  regenerateServiceSchedules,
} from "../features/services/api";
import type {
  CreateServicePayload,
  ServiceDetailResponse,
} from "../features/services/types";

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

  if (loading) {
    return <p className="text-sm text-slate-500">Cargando servicio…</p>;
  }

  if (error && !detail) {
    return <Alert variant="error">{error}</Alert>;
  }

  const service = detail?.service ?? null;
  const schedules = detail?.schedules ?? [];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Editar servicio</h1>
          {service && (
            <p className="text-sm text-slate-500">{service.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {saveMessage && <Alert variant="success">{saveMessage}</Alert>}

      {service && (
        <div className="grid gap-6 lg:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="glass-card glass-underlay-gradient space-y-4 border border-white/40 p-4 text-sm text-slate-600">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resumen</h2>
            <div className="space-y-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-white/45 bg-white/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">{card.value}</p>
                  {card.helper && <p className="text-[11px] text-slate-400">{card.helper}</p>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historial</h3>
              <ol className="space-y-2 text-xs text-slate-500">
                {historyItems.map((item) => (
                  <li key={item.title} className="rounded-xl border border-white/45 bg-white/70 p-3">
                    <p className="font-semibold text-slate-700">{item.title}</p>
                    {item.description && <p className="text-[11px] text-slate-400">{item.description}</p>}
                    <p className="text-[10px] uppercase tracking-wide text-slate-300">{item.date}</p>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <div className="space-y-6">
            <section className="glass-card glass-underlay-gradient border border-white/40 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Datos generales</h2>
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
                  onClick={() => handleRegenerate({ months: service.next_generation_months, startDate: service.start_date })}
                  disabled={saving}
                >
                  Regenerar cronograma
                </Button>
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
}
