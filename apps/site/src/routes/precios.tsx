import { Breadcrumbs, Card, Separator, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { publicClinicClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

type PriceRow = {
  name: string;
  category: string;
  unit: string;
  priceClp: number;
  notes: string | null;
};

const NOTES = [
  "Los valores corresponden a atención particular y pueden actualizarse. La versión vigente es la exhibida en el establecimiento.",
  "La inmunoterapia se cobra por alérgeno; el costo total de un esquema depende del número de alérgenos prescritos por el médico.",
  "El test de parche incluye la aplicación de la serie y las lecturas de seguimiento del estudio.",
  "Los valores incluyen los insumos propios de cada procedimiento. No incluyen medicamentos de uso domiciliario ni exámenes de laboratorio externos.",
  "Cualquier prestación no incluida en esta lista se informa y se acuerda con el paciente antes de su ejecución.",
];

function groupByCategory(items: PriceRow[]): [string, PriceRow[]][] {
  const map = new Map<string, PriceRow[]>();
  for (const item of items) {
    const group = map.get(item.category) ?? [];
    group.push(item);
    map.set(item.category, group);
  }
  return [...map.entries()];
}

function PriceGroup({ category, rows }: { category: string; rows: PriceRow[] }) {
  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-1">
        <Card.Title className="text-lg">{category}</Card.Title>
      </Card.Header>
      <Card.Content className="grid gap-4 pb-6">
        {rows.map((row) => (
          <div className="grid gap-1" key={`${category}-${row.name}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-(--ink)">{row.name}</span>
              <span className="font-semibold text-(--ink) tabular-nums">
                {CLP.format(row.priceClp)}
              </span>
            </div>
            <span className="text-(--ink-muted) text-sm">{row.unit}</span>
            {row.notes ? (
              <span className="text-(--ink-muted) text-xs leading-relaxed">{row.notes}</span>
            ) : null}
          </div>
        ))}
      </Card.Content>
    </Card>
  );
}

function PreciosPage() {
  const query = useQuery({
    queryKey: ["public-price-list"],
    queryFn: () => publicClinicClient.priceList(),
  });

  const items: PriceRow[] = query.data?.items ?? [];
  const groups = groupByCategory(items);
  const updatedAt = query.data?.updatedAt ?? null;

  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Precios", path: "/precios" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Precios</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
            Aranceles a la vista
          </div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">Lista de precios</h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Aranceles particulares vigentes, expresados en pesos chilenos (CLP), por prestación e
            incluyendo los insumos del procedimiento. La atención es particular (sin convenio) y el
            paciente recibe boleta o factura. Esta lista se mantiene a la vista del público conforme
            al derecho de información de la Ley N° 20.584.
          </p>
          {updatedAt ? (
            <p className="text-(--ink-muted) text-sm">
              Valores vigentes al{" "}
              {updatedAt.toLocaleDateString("es-CL", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              .
            </p>
          ) : null}
        </div>
      </section>

      {query.isPending ? (
        <div className="flex items-center gap-3 text-(--ink-muted) text-sm">
          <Spinner size="sm" />
          Cargando lista de precios…
        </div>
      ) : query.isError ? (
        <Card className="rounded-3xl" variant="secondary">
          <Card.Content className="grid gap-2 py-6">
            <span className="font-medium text-(--ink)">No pudimos cargar la lista de precios</span>
            <span className="text-(--ink-muted) text-sm leading-relaxed">
              Vuelve a intentarlo en unos minutos o escríbenos a contacto@bioalergia.cl para
              consultar los aranceles vigentes.
            </span>
          </Card.Content>
        </Card>
      ) : items.length === 0 ? (
        <Card className="rounded-3xl" variant="secondary">
          <Card.Content className="grid gap-2 py-6">
            <span className="font-medium text-(--ink)">Lista de precios en actualización</span>
            <span className="text-(--ink-muted) text-sm leading-relaxed">
              Estamos actualizando los aranceles. Escríbenos a contacto@bioalergia.cl o llámanos
              para conocer los valores vigentes.
            </span>
          </Card.Content>
        </Card>
      ) : (
        <Section title="Prestaciones y valores">
          <div className="grid gap-6 md:grid-cols-2">
            {groups.map(([category, rows]) => (
              <PriceGroup category={category} key={category} rows={rows} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Notas">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Content className="grid gap-3 py-6">
            <Separator className="mb-1" />
            {NOTES.map((note) => (
              <div className="flex items-start gap-3 text-sm leading-relaxed" key={note}>
                <span className="mt-2 rounded-full bg-(--accent) size-2" />
                <span className="text-(--ink-muted)">{note}</span>
              </div>
            ))}
          </Card.Content>
        </Card>
      </Section>
    </PageShell>
  );
}

export const Route = createFileRoute("/precios")({
  component: PreciosPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/precios`;
    return {
      meta: [
        { title: "Lista de precios · Bioalergia" },
        {
          name: "description",
          content:
            "Aranceles particulares vigentes de Bioalergia (CLP) para consulta de alergología, test cutáneo, prick-by-prick, test de parche e inmunoterapia. Lista a la vista conforme a la Ley N° 20.584.",
        },
        { property: "og:title", content: "Lista de precios · Bioalergia" },
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
