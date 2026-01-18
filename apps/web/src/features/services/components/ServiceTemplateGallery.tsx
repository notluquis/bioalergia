import Button from "@/components/ui/Button";
import { today } from "@/lib/dates";

import type { CreateServicePayload } from "../types";

export interface ServiceTemplate {
  category?: string;
  description: string;
  id: string;
  name: string;
  payload: Partial<CreateServicePayload>;
}

interface ServiceTemplateGalleryProps {
  onApply: (template: ServiceTemplate) => void;
}

const TODAY = today();

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    category: "Utilidades",
    description: "Ideal para cuentas de luz, agua, internet y telefonía",
    id: "utilities",
    name: "Servicios básicos",
    payload: {
      defaultAmount: 0,
      dueDay: 15,
      emissionDay: 1,
      emissionMode: "FIXED_DAY",
      frequency: "MONTHLY",
      monthsToGenerate: 12,
      obligationType: "SERVICE",
      ownership: "COMPANY",
      serviceType: "UTILITY",
      startDate: TODAY,
    },
  },
  {
    category: "Software",
    description: "Suscripciones mensuales de software o herramientas en la nube",
    id: "software_subscription",
    name: "Suscripción SaaS",
    payload: {
      defaultAmount: 0,
      dueDay: null,
      emissionExactDate: TODAY,
      emissionMode: "SPECIFIC_DATE",
      frequency: "MONTHLY",
      monthsToGenerate: 12,
      notes: "Renovación automática; revisar vencimiento de tarjeta asociada",
      obligationType: "SERVICE",
      ownership: "COMPANY",
      serviceType: "SOFTWARE",
      startDate: TODAY,
    },
  },
  {
    category: "Financiamiento",
    description: "Cuotas fijas para préstamos bancarios o renegociaciones",
    id: "loan_quota",
    name: "Cuota de préstamo",
    payload: {
      defaultAmount: 0,
      dueDay: 10,
      emissionDay: 5,
      emissionMode: "FIXED_DAY",
      frequency: "MONTHLY",
      lateFeeGraceDays: 3,
      lateFeeMode: "FIXED",
      lateFeeValue: 10_000,
      monthsToGenerate: 24,
      obligationType: "DEBT",
      ownership: "COMPANY",
      serviceType: "OTHER",
      startDate: TODAY,
    },
  },
  {
    category: "Personal",
    description: "Remuneraciones mensuales para colaboradores",
    id: "employee_salary",
    name: "Pago de sueldo",
    payload: {
      defaultAmount: 0,
      dueDay: null,
      emissionDay: 25,
      emissionMode: "FIXED_DAY",
      frequency: "MONTHLY",
      monthsToGenerate: 12,
      notes: "Considerar descuentos de AFP/Salud cuando corresponda",
      obligationType: "SERVICE",
      ownership: "COMPANY",
      serviceType: "PERSONAL",
      startDate: TODAY,
    },
  },
];

export default function ServiceTemplateGallery({ onApply }: ServiceTemplateGalleryProps) {
  return (
    <section className="border-base-300 text-base-content bg-base-100 space-y-4 border p-4 text-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base-content/60 text-sm font-semibold tracking-wide uppercase">Plantillas rápidas</h2>
        <p className="text-base-content/50 text-xs">
          Usa plantillas predefinidas para acelerar la creación de servicios.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SERVICE_TEMPLATES.map((template) => (
          <article
            className="border-base-300 bg-base-200 hover:border-primary/45 flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
            key={template.id}
          >
            <div className="space-y-2">
              <p className="text-base-content text-sm font-semibold">{template.name}</p>
              <p className="text-base-content/60 text-xs">{template.description}</p>
              {template.category && (
                <span className="border-base-300 bg-base-200 text-base-content/60 inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold tracking-wide uppercase">
                  {template.category}
                </span>
              )}
            </div>
            <Button
              onClick={() => {
                onApply(template);
              }}
              size="sm"
            >
              Usar plantilla
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
