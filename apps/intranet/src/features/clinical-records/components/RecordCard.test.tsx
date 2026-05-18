/**
 * Tests for RecordCard — clinical-records timeline card.
 *
 * PHI sensitivity: the component renders patient history, diagnoses,
 * medications, allergies, anthropometrics. Tests assert that:
 *  - empty optional fields are NOT rendered (no "null" leaking to UI),
 *  - allergies are visually flagged (warning color class),
 *  - the `data-phi-block` boundary marker is present (audit hook),
 *  - dates render in DD MMM YYYY format (Chilean spelling: Spanish locale agnostic).
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordCard, type RecordCardProps } from "./RecordCard";

function makeProps(overrides: Partial<RecordCardProps> = {}): RecordCardProps {
  return {
    consultDate: "2026-05-12",
    patientName: "Ana Pérez González",
    ageLabel: "32 años",
    history: "Paciente consulta por rinitis alérgica.",
    physicalExam: "Mucosa pálida edematosa.",
    diagnosis: "Rinitis alérgica perenne",
    indications: ["Loratadina 10 mg cada 24h", "Mometasona spray nasal"],
    antecedents: {
      personal: ["Asma infantil"],
      family: ["Madre con dermatitis atópica"],
    },
    medications: ["Salbutamol PRN"],
    knownAllergies: ["Polen de gramíneas", "Ácaros"],
    observations: "Reevaluar en 6 semanas.",
    weightKg: 62.5,
    heightCm: 165,
    headCircumferenceCm: null,
    anthropometric: { IMC: "22.9" },
    ...overrides,
  };
}

describe("RecordCard", () => {
  it("renders consult date, history, diagnosis, indications", () => {
    render(<RecordCard {...makeProps()} />);
    expect(screen.getByText(/12 may 2026|12 May 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/consulta por rinitis alérgica/i)).toBeInTheDocument();
    expect(screen.getByText(/Rinitis alérgica perenne/)).toBeInTheDocument();
    expect(screen.getByText(/Loratadina 10 mg cada 24h/)).toBeInTheDocument();
  });

  it("renders 'Sin fecha' fallback when consultDate is null", () => {
    render(<RecordCard {...makeProps({ consultDate: null })} />);
    expect(screen.getByText("Sin fecha")).toBeInTheDocument();
  });

  it("exposes a data-phi-block boundary for PHI audit hooks", () => {
    const { container } = render(<RecordCard {...makeProps()} />);
    expect(container.querySelector("[data-phi-block]")).not.toBeNull();
  });

  it("renders known allergies with warning emphasis", () => {
    render(<RecordCard {...makeProps()} />);
    const allergen = screen.getByText("Polen de gramíneas");
    expect(allergen).toBeInTheDocument();
    expect(allergen.className).toMatch(/text-warning/);
  });

  it("omits the Antecedentes section when both arrays are empty", () => {
    render(<RecordCard {...makeProps({ antecedents: { personal: [], family: [] } })} />);
    expect(screen.queryByText("Antecedentes")).not.toBeInTheDocument();
  });

  it("omits Indicaciones section when none provided", () => {
    render(<RecordCard {...makeProps({ indications: [] })} />);
    expect(screen.queryByText("Indicaciones")).not.toBeInTheDocument();
  });

  it("does not render Sección 'Observaciones' when observations is null", () => {
    render(<RecordCard {...makeProps({ observations: null })} />);
    expect(screen.queryByText("Observaciones")).not.toBeInTheDocument();
  });

  it("renders weight + height chips when present", () => {
    render(<RecordCard {...makeProps()} />);
    expect(screen.getByText("62.5 kg")).toBeInTheDocument();
    expect(screen.getByText("165 cm")).toBeInTheDocument();
    // headCircumferenceCm is null → no CC chip
    expect(screen.queryByText(/^CC /)).not.toBeInTheDocument();
  });

  it("caps anthropometric chips at 6", () => {
    const anthro: Record<string, string> = {};
    for (let i = 0; i < 10; i++) anthro[`metric${i}`] = String(i);
    render(<RecordCard {...makeProps({ anthropometric: anthro })} />);
    for (let i = 0; i < 6; i++) {
      expect(screen.getByText(`metric${i}: ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/metric6: 6/)).not.toBeInTheDocument();
  });
});
