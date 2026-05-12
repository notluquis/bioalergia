import { Link } from "@heroui/react";

import { contactInfo } from "@/data/clinic";
import { legalDocuments, legalOwner } from "@/data/legal";
import { doctoraliaLink } from "@/lib/doctoralia";

function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 rounded-3xl border border-border bg-(--surface)/88 px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="space-y-2">
          <p className="font-semibold text-sm text-(--ink)">{legalOwner.companyName}</p>
          <p className="max-w-xl text-(--ink-muted) text-sm">
            Centro médico especializado en alergología e inmunología en Concepción, Chile. Esta web
            entrega información general, vías de contacto y acceso a canales de coordinación
            asistencial.
          </p>
          <p className="text-(--ink-muted) text-sm">{contactInfo.address}</p>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-sm text-(--ink)">Legal</p>
          <div className="flex flex-col gap-1 text-sm">
            <Link
              className="w-fit no-underline hover:underline"
              href={legalDocuments.privacy.canonicalPath}
            >
              Política de Privacidad
            </Link>
            <Link
              className="w-fit no-underline hover:underline"
              href={legalDocuments.terms.canonicalPath}
            >
              Términos de Servicio
            </Link>
            <Link
              className="w-fit no-underline hover:underline"
              href={legalDocuments.dataDeletion.canonicalPath}
            >
              Eliminación de datos
            </Link>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-sm text-(--ink)">Contacto</p>
          <div className="flex flex-col gap-1 text-sm">
            <Link
              className="w-fit no-underline hover:underline"
              href={`mailto:${contactInfo.email}`}
            >
              {contactInfo.email}
            </Link>
            {contactInfo.phones.map((phone) => (
              <Link
                key={phone}
                className="w-fit no-underline hover:underline"
                href={whatsappLink(phone)}
              >
                {phone}
              </Link>
            ))}
            <Link className="w-fit no-underline hover:underline" href={doctoraliaLink}>
              Agenda online en Doctoralia
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 border-border border-t pt-4 text-(--ink-muted) text-xs sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {year} {legalOwner.companyName}. Todos los derechos reservados.
        </span>
        <span>Última actualización legal: {legalDocuments.privacy.lastUpdated}</span>
      </div>
    </footer>
  );
}
