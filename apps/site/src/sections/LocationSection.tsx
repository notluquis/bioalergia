import { Link } from "@heroui/react";

import { SectionBand } from "@/components/ui/SectionBand";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { contactInfo } from "@/data/clinic";

const clinicMapQuery = encodeURIComponent(contactInfo.address);
const clinicMapUrl = `https://www.google.com/maps/search/?api=1&query=${clinicMapQuery}`;
const clinicMapEmbedUrl = `https://www.google.com/maps?q=${clinicMapQuery}&output=embed`;

const rows = [
  { label: "Dirección", value: "Av. Prat 199, Of. A603, Edificio Centro Costanera" },
  { label: "Horario", value: "Lunes a viernes · 09:00–18:00" },
  { label: "Teléfonos", value: contactInfo.phones.join(" · ") },
  { label: "Email", value: contactInfo.email },
];

/** Visit (handoff) — clinic detail rows beside an embedded map. */
export function LocationSection() {
  return (
    <SectionBand id="ubicacion" tone="surface">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <Eyebrow className="mb-5">Visítanos</Eyebrow>
          <h2 className="mb-[30px] font-display text-[2.125rem] leading-[1.05] text-foreground sm:text-[2.625rem]">
            En el corazón de Concepción.
          </h2>
          {rows.map((row, i) => (
            <div
              key={row.label}
              className={`flex justify-between gap-4 border-line border-t py-4 ${i === rows.length - 1 ? "border-b" : ""}`}
            >
              <span className="font-bold text-[0.78rem] uppercase tracking-[0.06em] text-muted">
                {row.label}
              </span>
              <span className="max-w-[300px] text-right text-[0.94rem] text-foreground">
                {row.value}
              </span>
            </div>
          ))}
          <Link
            className={ctaClass("secondary", "mt-7")}
            href={clinicMapUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Cómo llegar
          </Link>
        </div>
        <div className="h-[360px] overflow-hidden rounded-md border border-line lg:h-[470px]">
          <iframe
            className="size-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={clinicMapEmbedUrl}
            title="Mapa Bioalergia"
          />
        </div>
      </div>
    </SectionBand>
  );
}
