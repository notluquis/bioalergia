import { Button, Card, Chip, Label, ProgressBar, Separator } from "@heroui/react";
import { type ReactNode, useState } from "react";

import type { QuizContent } from "@/data/quiz";
import { answeredCount as countAnswered, nextIndex, prevIndex } from "@/lib/quiz";

/**
 * Quiz de autoevaluación reutilizable (extraído de eres-alergico.tsx). Motor de
 * puntaje byte-idéntico al original: suma el `score` de la opción elegida y elige
 * el primer tramo de `results` cuyo `upTo` (inclusivo) cubre el total, o el último
 * (`upTo: null`) como tramo superior. Todo ocurre en el navegador; nada se envía.
 *
 * `resultFooter` permite inyectar un CTA (p. ej. <BookingCta>) bajo el resultado.
 */
export function ConditionQuiz({
  content,
  resultFooter,
}: {
  content: QuizContent;
  resultFooter?: ReactNode;
}) {
  const questions = content.questions;
  const disclaimer = content.disclaimer;
  const resultTiers = content.results;

  // answers[i] = índice de la opción elegida en questions[i]; undefined = sin responder.
  const [answers, setAnswers] = useState<(number | undefined)[]>(() =>
    Array.from({ length: questions.length }, () => undefined)
  );
  const [current, setCurrent] = useState(0);

  const answeredCount = countAnswered(answers);
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  const handleSelect = (optionIndex: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      return next;
    });
    setCurrent((prevCurrent) => nextIndex(prevCurrent, questions.length));
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

  const resultIndex = allAnswered
    ? (() => {
        const idx = resultTiers.findIndex((r) => r.upTo === null || totalScore <= r.upTo);
        return idx === -1 ? resultTiers.length - 1 : idx;
      })()
    : -1;
  const result = resultIndex >= 0 ? resultTiers[resultIndex] : null;
  const resultChipVariant = resultIndex === resultTiers.length - 1 ? "primary" : "secondary";

  return (
    <div className="grid gap-6">
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
          {resultFooter}
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
                  onPress={() => setCurrent((prev) => prevIndex(prev))}
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
                      onPress={() => setCurrent((prev) => nextIndex(prev, questions.length))}
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
    </div>
  );
}
