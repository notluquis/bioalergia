import { Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { breadcrumbJsonLd } from "@/lib/seo";

const DERECHOS = [
  "Recibir un trato digno y respetuoso, sin discriminación.",
  "Ser informado de forma oportuna y comprensible sobre su estado de salud, el diagnóstico, las alternativas de tratamiento, sus riesgos y el pronóstico.",
  "Otorgar o rechazar su consentimiento de manera libre e informada antes de los procedimientos, salvo las excepciones que la ley contempla.",
  "Que se respete la confidencialidad y reserva de la información de su ficha clínica y de sus datos de salud.",
  "Que se resguarde su privacidad durante la atención.",
  "Conocer el nombre y la función de las personas que lo atienden.",
  "Saber que el establecimiento cuenta con la autorización sanitaria correspondiente.",
  "Recibir información sobre los valores de las prestaciones y un detalle de los gastos en que incurra.",
  "Acceder a su ficha clínica y solicitar copia de ella.",
  "Recibir un certificado o informe de la atención que se le brinde.",
  "Presentar reclamos y sugerencias, y recibir respuesta dentro del plazo legal.",
];

const DEBERES = [
  "Entregar información veraz y completa sobre su salud, su identidad y su domicilio.",
  "Informar si utiliza medicamentos, en especial antihistamínicos, betabloqueantes u otros que puedan influir en los procedimientos.",
  "Tratar con respeto al personal del establecimiento y a los demás pacientes.",
  "Cuidar las instalaciones y el equipamiento.",
  "Cumplir las indicaciones clínicas y las normas internas del establecimiento.",
  "Informarse sobre el funcionamiento del establecimiento, los horarios y las formas de pago.",
  "Conocer el procedimiento para presentar reclamos y sugerencias.",
];

function EditorialList({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <Eyebrow className="mb-3">{eyebrow}</Eyebrow>
      <h2 className="mb-6 font-display text-[1.5rem] leading-[1.1] text-foreground sm:text-[1.75rem]">
        {title}
      </h2>
      <ul className="grid">
        {items.map((item) => (
          <li
            className="flex items-start gap-3 border-line border-b py-4 text-[0.95rem] text-muted leading-relaxed last:border-b-0"
            key={item}
          >
            <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-amber" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DerechosDeberesPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Derechos y deberes", path: "/derechos-deberes" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Derechos y deberes" }]}
        eyebrow="Ley 20.584"
        lede="En Bioalergia respetamos los derechos y deberes de las personas en su atención de salud, establecidos en la Ley N° 20.584. Esta carta se mantiene visible para todos los pacientes y sus acompañantes."
        title="Carta de Derechos y Deberes del Paciente"
      />

      <SectionBand borderTop tone="surface2">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <EditorialList eyebrow="Derechos" items={DERECHOS} title="Usted tiene derecho a" />
          <EditorialList eyebrow="Deberes" items={DEBERES} title="Usted tiene el deber de" />
        </div>
      </SectionBand>

      <SectionBand tone="surface">
        <div className="mx-auto max-w-[760px]">
          <Eyebrow className="mb-3">Reclamos y sugerencias</Eyebrow>
          <h2 className="mb-6 font-display text-[1.875rem] leading-[1.1] text-foreground sm:text-[2.25rem]">
            Si no está conforme con la atención
          </h2>
          <p className="border-line border-t pt-6 text-[1.0625rem] text-muted leading-[1.75]">
            Si usted no está conforme con la atención, puede presentar un reclamo. El
            establecimiento lo registrará y le responderá por escrito dentro de quince días hábiles.
            Si la respuesta no le satisface, puede recurrir a la Superintendencia de Salud
            (Intendencia de Prestadores). Solicite el formulario de reclamo en recepción o utilice
            el{" "}
            <Link className="text-brand-blue" href="/reclamos">
              formulario en línea
            </Link>
            .
          </p>
        </div>
      </SectionBand>
    </PageShell>
  );
}

export const Route = createFileRoute("/derechos-deberes")({
  component: DerechosDeberesPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/derechos-deberes`;
    return {
      meta: [
        { title: "Carta de Derechos y Deberes del Paciente · Bioalergia" },
        {
          name: "description",
          content:
            "Carta de Derechos y Deberes del Paciente de Bioalergia conforme a la Ley N° 20.584: trato digno, información, consentimiento, confidencialidad, acceso a ficha clínica, reclamos y deberes del paciente.",
        },
        { property: "og:title", content: "Carta de Derechos y Deberes del Paciente · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
