import { Breadcrumbs, Button, Card, Chip, Label, ProgressBar, Separator } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { quizContent } from "@/data/quiz";
import { breadcrumbJsonLd } from "@/lib/seo";

const questions = quizContent.questions;
const disclaimer = quizContent.disclaimer;
const resultTiers = quizContent.results;

function EresAlergicoPage() {
  // answers[i] = índice de la opción elegida en questions[i]; undefined = sin responder.
  const [answers, setAnswers] = useState<(number | undefined)[]>(() =>
    Array.from({ length: questions.length }, () => undefined)
  );
  const [current, setCurrent] = useState(0);

  const answeredCount = answers.filter((value) => value !== undefined).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const handleSelect = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      return next;
    });
    // Avanza a la siguiente pregunta sin responder, o a la última si ya está todo.
    setCurrent((prevCurrent) => Math.min(prevCurrent + 1, questions.length - 1));
  };

  const handleReset = () => {
    setAnswers(questions.map(() => undefined));
    setCurrent(0);
  };

  const totalScore = answers.reduce<number>((sum, optionIndex, questionIndex) => {
    if (optionIndex === undefined) return sum;
    return sum + (questions[questionIndex]?.options[optionIndex]?.score ?? 0);
  }, 0);

  const question = questions[current];

  // Tramos ordenados: el primero cuyo `upTo` (inclusivo) cubre el puntaje, o el
  // último (upTo null) como tramo superior.
  const resultIndex = allAnswered
    ? (() => {
        const idx = resultTiers.findIndex((r) => r.upTo === null || totalScore <= r.upTo);
        return idx === -1 ? resultTiers.length - 1 : idx;
      })()
    : -1;
  const result = resultIndex >= 0 ? resultTiers[resultIndex] : null;
  // Último tramo (mayor probabilidad) = "primary"; el resto = "secondary".
  const resultChipVariant = resultIndex === resultTiers.length - 1 ? "primary" : "secondary";

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

      {/* Disclaimer siempre visible arriba */}
      <Card className="rounded-3xl border-border" variant="secondary">
        <Card.Content className="flex items-start gap-3 py-5">
          <span className="mt-1.5 rounded-full bg-(--accent) size-2 shrink-0" aria-hidden="true" />
          <p className="text-(--ink-muted) text-sm leading-relaxed">
            <span className="font-semibold text-(--ink)">Importante: </span>
            {disclaimer}
          </p>
        </Card.Content>
      </Card>

      {result ? (
        <section className="grid gap-6">
          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Card.Title className="text-2xl">{result.title}</Card.Title>
                <Chip size="sm" variant={resultChipVariant}>
                  Resultado
                </Chip>
              </div>
              <Card.Description className="text-(--ink-muted) text-base leading-relaxed">
                {result.message}
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-5 pb-6">
              <Separator />
              <p className="text-(--ink-muted) text-sm leading-relaxed">
                <span className="font-semibold text-(--ink)">Recuerda: </span>
                {disclaimer}
              </p>
              <div>
                <Button className="rounded-full" variant="secondary" onPress={handleReset}>
                  Reiniciar autoevaluación
                </Button>
              </div>
            </Card.Content>
          </Card>

          <BookingCta
            title="Da el siguiente paso con un especialista"
            description="Agenda una evaluación y, con el estudio adecuado, identifiquemos qué desencadena tus síntomas y el tratamiento que mejor se adapta a ti."
            location="quiz_result"
          />
        </section>
      ) : question ? (
        <section className="grid gap-6">
          <ProgressBar
            aria-label="Progreso de la autoevaluación"
            className="w-full"
            color="accent"
            maxValue={questions.length}
            value={answeredCount}
          >
            <div className="flex items-center justify-between">
              <Label className="text-(--ink-muted) text-sm">
                Pregunta {current + 1} de {questions.length}
              </Label>
              <ProgressBar.Output className="text-(--ink-muted) text-sm" />
            </div>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>

          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="text-xl leading-snug">{question.text}</Card.Title>
            </Card.Header>
            <Card.Content className="grid gap-3 pb-6">
              {question.options.map((option, optionIndex) => {
                const selected = answers[current] === optionIndex;
                return (
                  <Button
                    className={`w-full justify-start rounded-2xl px-5 py-4 text-left text-base ${
                      selected ? "bg-(--accent) text-white" : "bg-(--surface-2) text-(--ink)"
                    }`}
                    key={option.label}
                    variant={selected ? "primary" : "secondary"}
                    onPress={() => handleSelect(optionIndex)}
                  >
                    {option.label}
                  </Button>
                );
              })}

              <Separator className="my-1" />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  className="rounded-full"
                  isDisabled={current === 0}
                  variant="tertiary"
                  onPress={() => setCurrent((prev) => Math.max(prev - 1, 0))}
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-3">
                  {answeredCount > 0 ? (
                    <Button className="rounded-full" variant="tertiary" onPress={handleReset}>
                      Reiniciar
                    </Button>
                  ) : null}
                  {answers[current] !== undefined && current < questions.length - 1 ? (
                    <Button
                      className="rounded-full"
                      variant="secondary"
                      onPress={() => setCurrent((prev) => Math.min(prev + 1, questions.length - 1))}
                    >
                      Siguiente
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card.Content>
          </Card>
        </section>
      ) : null}
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
