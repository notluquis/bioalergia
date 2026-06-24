import { Breadcrumbs, Card, Link } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

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

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-1">
        <Card.Title className="text-lg">{title}</Card.Title>
      </Card.Header>
      <Card.Content className="grid gap-3 pb-6">
        {items.map((item) => (
          <div className="flex items-start gap-3 text-sm leading-relaxed" key={item}>
            <span className="mt-2 rounded-full bg-(--accent) size-2" />
            <span className="text-(--ink-muted)">{item}</span>
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

function DerechosDeberesPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Derechos y deberes", path: "/derechos-deberes" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Derechos y deberes</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Ley 20.584</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Carta de Derechos y Deberes del Paciente
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            En Bioalergia respetamos los derechos y deberes de las personas en su atención de salud,
            establecidos en la Ley N° 20.584. Esta carta se mantiene visible para todos los pacientes
            y sus acompañantes.
          </p>
        </div>
      </section>

      <Section title="Derechos y deberes">
        <div className="grid gap-6 lg:grid-cols-2">
          <ListCard items={DERECHOS} title="Usted tiene derecho a" />
          <ListCard items={DEBERES} title="Usted tiene el deber de" />
        </div>
      </Section>

      <Section title="Reclamos y sugerencias">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Si usted no está conforme con la atención, puede presentar un reclamo. El
              establecimiento lo registrará y le responderá por escrito dentro de quince días
              hábiles. Si la respuesta no le satisface, puede recurrir a la Superintendencia de Salud
              (Intendencia de Prestadores). Solicite el formulario de reclamo en recepción o utilice
              el{" "}
              <Link className="text-(--accent)" href="/reclamos">
                formulario en línea
              </Link>
              .
            </Card.Description>
          </Card.Header>
        </Card>
      </Section>
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
