import { Breadcrumbs } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";

import { BookingCta } from "@/components/BookingCta";
import { ConditionQuiz } from "@/components/ConditionQuiz";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { quizContent } from "@/data/quiz";
import { breadcrumbJsonLd } from "@/lib/seo";

function EresAlergicoPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "¿Eres alérgico?", path: "/eres-alergico" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>¿Eres alérgico?</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
            Autoevaluación
          </div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            ¿Eres alérgico? Haz tu autoevaluación
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Responde ocho preguntas rápidas sobre tus síntomas y antecedentes. Al terminar verás una
            orientación que te ayudará a decidir si conviene una evaluación con un especialista.
            Nada de lo que respondas se guarda ni se envía: todo ocurre en tu navegador.
          </p>
        </div>
      </section>

      <ConditionQuiz
        content={quizContent}
        resultFooter={
          <BookingCta
            title="Da el siguiente paso con un especialista"
            description="Agenda una evaluación y, con el estudio adecuado, identifiquemos qué desencadena tus síntomas y el tratamiento que mejor se adapta a ti."
            location="quiz_result"
          />
        }
      />
    </PageShell>
  );
}

export const Route = createFileRoute("/eres-alergico")({
  component: EresAlergicoPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/eres-alergico`;
    return {
      meta: [
        { title: "¿Eres alérgico? Autoevaluación · Bioalergia" },
        {
          name: "description",
          content:
            "Autoevaluación referencial de síntomas alérgicos: responde 8 preguntas y conoce si conviene una evaluación con un especialista en alergias en Concepción. No es un diagnóstico médico.",
        },
        { property: "og:title", content: "¿Eres alérgico? Autoevaluación · Bioalergia" },
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
