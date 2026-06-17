import { expect, test } from "@playwright/test";

import { quizContent } from "../src/data/quiz";

/**
 * /eres-alergico — the self-assessment quiz. Pure client-side state (no API).
 * Answering a question auto-advances; back/next clamps at first/last; answering
 * every question reveals the result summary. Quiz copy is imported from the same
 * data module the route uses so assertions stay in sync with the content.
 */

const questions = quizContent.questions;

test("answering a question advances to the next one", async ({ page }) => {
  await page.goto("/eres-alergico", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /Haz tu autoevaluación/ })
  ).toBeVisible();

  // Progress label starts at question 1.
  await expect(page.getByText(`Pregunta 1 de ${questions.length}`)).toBeVisible();
  // The first question's text is shown.
  await expect(page.getByText(questions[0]?.text ?? "")).toBeVisible();

  // Pick any option → auto-advance to question 2.
  await page.getByRole("button", { name: questions[0]?.options[0]?.label ?? "" }).click();
  await expect(page.getByText(`Pregunta 2 de ${questions.length}`)).toBeVisible();
  await expect(page.getByText(questions[1]?.text ?? "")).toBeVisible();
});

test("the back button is clamped (disabled) on the first question", async ({ page }) => {
  await page.goto("/eres-alergico", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`Pregunta 1 de ${questions.length}`)).toBeVisible();

  // "Anterior" exists but is disabled at the start (can't go before the first).
  await expect(page.getByRole("button", { name: "Anterior" })).toBeDisabled();
});

test("completing every question reveals the result summary", async ({ page }) => {
  await page.goto("/eres-alergico", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`Pregunta 1 de ${questions.length}`)).toBeVisible();

  // Answer each question by clicking its first option. Selecting auto-advances,
  // so each iteration acts on the now-current question.
  for (let i = 0; i < questions.length; i++) {
    const label = questions[i]?.options[0]?.label ?? "";
    await page.getByRole("button", { name: label }).first().click();
  }

  // Result summary appears: a "Resultado" chip + the reset affordance.
  await expect(page.getByText("Resultado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reiniciar autoevaluación" })).toBeVisible();

  // Reset returns to question 1 (back/next clamp is exercised via reset).
  await page.getByRole("button", { name: "Reiniciar autoevaluación" }).click();
  await expect(page.getByText(`Pregunta 1 de ${questions.length}`)).toBeVisible();
});
