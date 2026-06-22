import { Breadcrumbs, Card, Chip, Separator } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ConditionQuiz } from "@/components/ConditionQuiz";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
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
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-3">
            <Card.Title className="text-xl">Condición no encontrada</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              No pudimos encontrar la guía que buscas. Puede que el enlace haya cambiado.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Link
              className="font-semibold text-(--ink) text-sm no-underline hover:underline"
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

        <header className="grid gap-4">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Condición</div>
          <h1 className="max-w-3xl font-semibold text-(--ink) text-3xl sm:text-4xl">
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
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            {condition.heroIntro}
          </p>
        </header>

        <Separator />

        <div className="grid gap-8">
          {condition.sections.map((section) => (
            <section className="grid gap-3" key={section.heading}>
              <h2 className="font-semibold text-(--ink) text-xl sm:text-2xl">{section.heading}</h2>
              <p className="text-(--ink-muted) text-base leading-relaxed">{section.body}</p>
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="grid gap-2">
                  {section.bullets.map((item) => (
                    <li className="flex items-start gap-3 text-base leading-relaxed" key={item}>
                      <span className="mt-2.5 rounded-full bg-(--accent) size-2 shrink-0" />
                      <span className="text-(--ink-muted)">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {condition.relatedExams.length > 0 ? (
          <Card className="rounded-3xl" variant="secondary">
            <Card.Header className="gap-2">
              <Card.Title className="text-lg">Exámenes relacionados</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-wrap gap-2 pb-6">
              {condition.relatedExams.map((exam) => (
                <Chip key={exam} size="sm" variant="soft">
                  {exam}
                </Chip>
              ))}
              <Link
                className="ml-1 self-center font-semibold text-(--ink) text-sm no-underline hover:underline"
                to="/examenes"
              >
                Ver exámenes →
              </Link>
            </Card.Content>
          </Card>
        ) : null}
      </article>

      <section className="grid gap-6">
        <h2 className="font-semibold text-(--ink) text-2xl">Preguntas frecuentes</h2>
        <div className="grid gap-4">
          {condition.faq.map((item) => (
            <Card className="rounded-3xl" key={item.question} variant="default">
              <Card.Header className="gap-2">
                <Card.Title className="text-lg">{item.question}</Card.Title>
                <Card.Description className="text-(--ink-muted) leading-relaxed">
                  {item.answer}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="font-semibold text-(--ink) text-2xl">Autoevaluación rápida</h2>
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
