import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ConditionQuiz } from "@/components/ConditionQuiz";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { type Condition, getCondition } from "@/data/conditions";
import { breadcrumbJsonLd, faqJsonLd, medicalWebPageJsonLd } from "@/lib/seo";

function ConditionNotFound() {
  return (
    <PageShell>
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/condiciones">Condiciones</Breadcrumbs.Item>
        </Breadcrumbs>
        <Card className="rounded-2xl border border-line bg-surface" variant="secondary">
          <Card.Header className="gap-3">
            <Card.Title className="font-display text-[1.5rem] text-foreground leading-[1.15]">
              Condición no encontrada
            </Card.Title>
            <Card.Description className="text-muted leading-relaxed">
              No pudimos encontrar la guía que buscas. Puede que el enlace haya cambiado.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Link
              className="font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
              to="/condiciones"
            >
              ← Ver todas las condiciones
            </Link>
          </Card.Content>
        </Card>
      </section>
    </PageShell>
  );
}

function ConditionDetail({ condition }: { condition: Condition }) {
  return (
    <PageShell>
      <JsonLd
        data={medicalWebPageJsonLd({
          name: condition.title,
          description: condition.metaDescription,
          path: `/condiciones/${condition.slug}`,
          about: condition.title,
          alternateName: condition.synonyms,
          lastReviewed: condition.lastReviewed,
        })}
      />
      <JsonLd data={faqJsonLd(condition.faq)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Condiciones", path: "/condiciones" },
          { name: condition.title, path: `/condiciones/${condition.slug}` },
        ])}
      />

      <article className="grid gap-6">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item href="/condiciones">Condiciones</Breadcrumbs.Item>
          <Breadcrumbs.Item>{condition.title}</Breadcrumbs.Item>
        </Breadcrumbs>

        <header className="grid max-w-[720px] gap-4">
          <Eyebrow>Condición</Eyebrow>
          <h1 className="font-display text-[2.5rem] text-foreground leading-[1.04] sm:text-[3.25rem]">
            {condition.title}
          </h1>
          {condition.synonyms.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {condition.synonyms.map((syn) => (
                <Chip key={syn} size="sm" variant="secondary">
                  {syn}
                </Chip>
              ))}
            </div>
          ) : null}
          <p className="text-[1.0625rem] text-muted leading-[1.6] sm:text-lg">
            {condition.heroIntro}
          </p>
        </header>

        <Separator />

        <div className="grid max-w-[720px] gap-8">
          {condition.sections.map((section) => (
            <section className="grid gap-3" key={section.heading}>
              <h2 className="font-display text-[1.6rem] text-foreground leading-[1.15] sm:text-[1.9rem]">
                {section.heading}
              </h2>
              <p className="text-base text-muted leading-relaxed">{section.body}</p>
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="grid gap-2">
                  {section.bullets.map((item) => (
                    <li className="flex items-start gap-3 text-base leading-relaxed" key={item}>
                      <span className="mt-2.5 rounded-full bg-brand-amber size-2 shrink-0" />
                      <span className="text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {condition.relatedExams.length > 0 ? (
          <Card className="rounded-2xl border border-line bg-surface-2" variant="secondary">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-[1.35rem] text-foreground leading-[1.15]">
                Exámenes relacionados
              </Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-wrap gap-2 pb-6">
              {condition.relatedExams.map((exam) => (
                <Chip key={exam} size="sm" variant="soft">
                  {exam}
                </Chip>
              ))}
              <Link
                className="ml-1 self-center font-semibold text-brand-blue text-sm no-underline hover:underline underline-offset-4"
                to="/examenes"
              >
                Ver exámenes →
              </Link>
            </Card.Content>
          </Card>
        ) : null}
      </article>

      <section className="grid gap-6">
        <h2 className="font-display text-[1.75rem] text-foreground leading-[1.1] sm:text-[2.25rem]">
          Preguntas frecuentes
        </h2>
        <div className="grid gap-4">
          {condition.faq.map((item) => (
            <Card
              className="rounded-2xl border border-line bg-surface"
              key={item.question}
              variant="default"
            >
              <Card.Header className="gap-2">
                <Card.Title className="font-display text-[1.3rem] text-foreground leading-[1.2]">
                  {item.question}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {item.answer}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="font-display text-[1.75rem] text-foreground leading-[1.1] sm:text-[2.25rem]">
          Autoevaluación rápida
        </h2>
        <ConditionQuiz
          content={condition.quiz}
          resultFooter={
            <BookingCta
              title="Da el siguiente paso con un especialista"
              description="Agenda una evaluación y definamos el estudio o tratamiento adecuado para ti."
              location="condicion_quiz_result"
            />
          }
        />
      </section>
    </PageShell>
  );
}

function ConditionPage() {
  const { slug } = Route.useParams();
  const condition = getCondition(slug);
  if (!condition) return <ConditionNotFound />;
  return <ConditionDetail condition={condition} />;
}

export const Route = createFileRoute("/condiciones/$slug")({
  component: ConditionPage,
  head: ({ params }) => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/condiciones/${params.slug}`;
    const condition = getCondition(params.slug);
    const title = condition?.metaTitle ?? "Condición · Bioalergia";
    const description =
      condition?.metaDescription ?? "Información sobre condiciones de alergia en Concepción.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:title", content: title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: `${origin}/og-image.png` },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
