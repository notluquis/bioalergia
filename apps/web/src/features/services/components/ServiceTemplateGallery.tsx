import Button from "@/components/ui/Button";
import { today } from "@/lib/dates";

import type { CreateServicePayload } from "../types";

export type ServiceTemplate = {
  id: string;
  name: string;
  description: string;
  category?: string;
  payload: Partial<CreateServicePayload>;
};

type ServiceTemplateGalleryProps = {
  onApply: (template: ServiceTemplate) => void;
};

const TODAY = today();

export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    id: "utilities",
    name: "Servicios básicos",
    description: "Ideal para cuentas de luz, agua, internet y telefonía",
    category: "Utilidades",
    payload: {
      serviceType: "UTILITY",
      frequency: "MONTHLY",
      obligationType: "SERVICE",
      ownership: "COMPANY",
      defaultAmount: 0,
      emissionMode: "FIXED_DAY",
      emissionDay: 1,
      dueDay: 15,
      startDate: TODAY,
      monthsToGenerate: 12,
    },
  },
  {
    id: "software_subscription",
    name: "Suscripción SaaS",
    description: "Suscripciones mensuales de software o herramientas en la nube",
    category: "Software",
    payload: {
      serviceType: "SOFTWARE",
      frequency: "MONTHLY",
      obligationType: "SERVICE",
      ownership: "COMPANY",
      defaultAmount: 0,
      emissionMode: "SPECIFIC_DATE",
      emissionExactDate: TODAY,
      dueDay: null,
      startDate: TODAY,
      monthsToGenerate: 12,
      notes: "Renovación automática; revisar vencimiento de tarjeta asociada",
    },
  },
  {
    id: "loan_quota",
    name: "Cuota de préstamo",
    description: "Cuotas fijas para préstamos bancarios o renegociaciones",
    category: "Financiamiento",
    payload: {
      serviceType: "OTHER",
      obligationType: "DEBT",
      ownership: "COMPANY",
      frequency: "MONTHLY",
      defaultAmount: 0,
      emissionMode: "FIXED_DAY",
      emissionDay: 5,
      dueDay: 10,
      startDate: TODAY,
      monthsToGenerate: 24,
      lateFeeMode: "FIXED",
      lateFeeValue: 10000,
      lateFeeGraceDays: 3,
    },
  },
  {
    id: "employee_salary",
    name: "Pago de sueldo",
    description: "Remuneraciones mensuales para colaboradores",
    category: "Personal",
    payload: {
      serviceType: "PERSONAL",
      ownership: "COMPANY",
      obligationType: "SERVICE",
      frequency: "MONTHLY",
      defaultAmount: 0,
      emissionMode: "FIXED_DAY",
      emissionDay: 25,
      dueDay: null,
      startDate: TODAY,
      monthsToGenerate: 12,
      notes: "Considerar descuentos de AFP/Salud cuando corresponda",
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
            key={template.id}
            className="border-base-300 bg-base-200 hover:border-primary/45 flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
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
            <Button size="sm" onClick={() => onApply(template)}>
              Usar plantilla
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
