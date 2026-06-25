import { Card, Chip, Description, Link, Surface } from "@heroui/react";

import { SiteFooter } from "@/components/SiteFooter";
import { ctaClass } from "@/components/ui/cta";
import type { LegalDocument } from "@/data/legal";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <>
      <main className="grid gap-8">
        <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr] xl:items-start">
          <Card className="overflow-hidden border border-line bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
            <Card.Content className="space-y-6 px-5 py-6 sm:p-7">
              <div className="flex flex-wrap gap-2">
                {document.chips.map((chip) => (
                  <Chip key={chip} variant="soft">
                    {chip}
                  </Chip>
                ))}
              </div>

              <div className="space-y-3">
                <p className="font-bold text-[0.75rem] text-eyebrow uppercase leading-none tracking-[0.16em]">
                  {document.eyebrow}
                </p>
                <h1 className="max-w-3xl font-display text-[2.5rem] text-foreground leading-[1.04] sm:text-[3rem]">
                  {document.title}
                </h1>
                <p className="max-w-3xl text-[1.0625rem] text-muted leading-[1.6]">
                  {document.summary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {document.highlights.map((item) => (
                  <Surface
                    key={item.label}
                    className="rounded-2xl border border-line bg-surface-2 px-4 py-3"
                  >
                    <Description className="text-[11px] text-eyebrow uppercase tracking-[0.16em]">
                      {item.label}
                    </Description>
                    <p className="mt-2 font-semibold text-foreground text-sm">{item.value}</p>
                  </Surface>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 border-line border-t pt-4 text-muted text-sm">
                <span>Última actualización: {document.lastUpdated}</span>
                <span>Vigencia: {document.effectiveDate}</span>
              </div>
            </Card.Content>
          </Card>

          <div className="grid gap-4 xl:sticky xl:top-28">
            <Card className="border border-line bg-surface">
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-display text-lg text-foreground">Contenido</h2>
                <Card.Description className="text-muted text-xs">
                  Navega por cada sección del documento.
                </Card.Description>
              </Card.Header>
              <Card.Content className="flex flex-col gap-2">
                {document.sections.map((section) => (
                  <Link
                    key={section.id}
                    className="w-fit text-brand-blue text-sm no-underline transition hover:underline"
                    href={`#${section.id}`}
                  >
                    {section.title}
                  </Link>
                ))}
              </Card.Content>
            </Card>

            <Card className="border border-line bg-surface">
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-display text-lg text-foreground">Acción rápida</h2>
                <Card.Description className="text-muted text-xs">
                  Si necesitas un requerimiento formal, usa el correo de contacto publicado.
                </Card.Description>
              </Card.Header>
              <Card.Content>
                <Link
                  className={ctaClass("primary", "w-full")}
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
                className="scroll-mt-28 border border-line bg-surface shadow-[0_18px_55px_rgba(0,0,0,0.10)]"
              >
                <Card.Content className="space-y-4 p-5 sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-amber/15 font-semibold text-brand-amber-ink text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-3">
                      <h2 className="font-display text-2xl text-foreground">{section.title}</h2>
                      {section.paragraphs?.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="max-w-[760px] text-[15px] text-muted leading-[1.7]"
                        >
                          {paragraph}
                        </p>
                      ))}
                      {section.bullets ? (
                        <ul className="grid max-w-[760px] gap-2 pl-5 text-[15px] text-muted leading-[1.7]">
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

          <Card className="h-fit border border-line bg-surface xl:sticky xl:top-28">
            <Card.Header className="flex flex-col items-start gap-1">
              <h2 className="font-display text-lg text-foreground">Referencias oficiales</h2>
              <Card.Description className="text-muted text-xs">
                Marco legal y regulatorio considerado en la redacción.
              </Card.Description>
            </Card.Header>
            <Card.Content className="space-y-3">
              {document.references.map((reference) => (
                <Surface
                  key={reference.href}
                  className="rounded-2xl border border-line bg-surface-2 px-4 py-3"
                >
                  <p className="font-medium text-foreground text-sm">{reference.label}</p>
                  {reference.note ? (
                    <Description className="mt-1 text-muted text-xs">{reference.note}</Description>
                  ) : null}
                  <Link
                    className="mt-2 inline-flex text-brand-blue text-sm no-underline transition hover:underline"
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
