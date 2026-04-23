import { Card, Chip, Description, Link, Surface } from "@heroui/react";

import { SiteFooter } from "@/components/SiteFooter";
import type { LegalDocument } from "@/data/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <>
      <main className="grid gap-8">
        <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr] xl:items-start">
          <Card className="overflow-hidden border border-border bg-(--surface)/92 shadow-[0_24px_80px_rgba(0,0,0,0.14)] backdrop-blur">
            <Card.Content className="space-y-6 px-5 py-6 sm:px-7 sm:py-7">
              <div className="flex flex-wrap gap-2">
                {document.chips.map((chip) => (
                  <Chip key={chip} variant="soft">
                    {chip}
                  </Chip>
                ))}
              </div>

              <div className="space-y-3">
                <p className="font-medium text-(--accent-2) text-sm uppercase tracking-[0.18em]">
                  {document.eyebrow}
                </p>
                <h1 className="max-w-3xl font-semibold text-(--ink) text-3xl leading-tight sm:text-4xl">
                  {document.title}
                </h1>
                <p className="max-w-3xl text-(--ink-muted) text-base sm:text-lg">
                  {document.summary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {document.highlights.map((item) => (
                  <Surface
                    key={item.label}
                    className="rounded-2xl border border-border bg-(--surface-2) px-4 py-3"
                  >
                    <Description className="text-(--ink-muted) text-[11px] uppercase tracking-[0.16em]">
                      {item.label}
                    </Description>
                    <p className="mt-2 font-semibold text-(--ink) text-sm">{item.value}</p>
                  </Surface>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 text-(--ink-muted) text-sm">
                <span>Última actualización: {document.lastUpdated}</span>
                <span>Vigencia: {document.effectiveDate}</span>
              </div>
            </Card.Content>
          </Card>

          <div className="grid gap-4 xl:sticky xl:top-28">
            <Card className="border border-border bg-(--surface)/88 backdrop-blur">
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Contenido</h2>
                <Card.Description className="text-(--ink-muted) text-xs">
                  Navega por cada sección del documento.
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                {document.sections.map((section) => (
                  <Link
                    key={section.id}
                    className="w-fit text-sm no-underline transition hover:underline"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </Link>
                ))}
              </Card.Content>
            </Card>

            <Card className="border border-border bg-(--surface)/88 backdrop-blur">
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Acción rápida</h2>
                <Card.Description className="text-(--ink-muted) text-xs">
                  Si necesitas un requerimiento formal, usa el correo de contacto publicado.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full bg-(--accent-2) px-4 py-2.5 font-medium text-sm text-white no-underline transition hover:opacity-90"
                  href="mailto:contacto@bioalergia.cl"
                >
                  Escribir a contacto@bioalergia.cl
                </Link>
              </Card.Content>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.72fr_0.28fr]">
          <div className="grid gap-4">
            {document.sections.map((section, index) => (
              <Card
                id={section.id}
                key={section.id}
                className="scroll-mt-28 border border-border bg-(--surface)/90 shadow-[0_18px_55px_rgba(0,0,0,0.10)] backdrop-blur"
              >
                <Card.Content className="space-y-4 px-5 py-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--accent-2)/10 font-semibold text-(--accent-2) text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-3">
                      <h2 className="font-semibold text-(--ink) text-xl">{section.title}</h2>
                      {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph} className="max-w-3xl text-(--ink-muted) text-sm sm:text-[15px]">
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets ? (
                        <ul className="grid gap-2 pl-5 text-(--ink-muted) text-sm sm:text-[15px]">
                          {section.bullets.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>

          <Card className="h-fit border border-border bg-(--surface)/88 backdrop-blur xl:sticky xl:top-28">
            <Card.Header className="flex flex-col items-start gap-1">
              <h2 className="font-semibold text-base">Referencias oficiales</h2>
              <Card.Description className="text-(--ink-muted) text-xs">
                Marco legal y regulatorio considerado en la redacción.
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-3">
              {document.references.map((reference) => (
                <Surface
                  key={reference.href}
                  className="rounded-2xl border border-border bg-(--surface-2) px-4 py-3"
                >
                  <p className="font-medium text-(--ink) text-sm">{reference.label}</p>
                  {reference.note ? (
                    <Description className="mt-1 text-(--ink-muted) text-xs">
                      {reference.note}
                    </Description>
                  ) : null}
                  <Link
                    className="mt-2 inline-flex text-sm no-underline transition hover:underline"
                    href={reference.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ver fuente oficial
                  </Link>
                </Surface>
              ))}
            </Card.Content>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
