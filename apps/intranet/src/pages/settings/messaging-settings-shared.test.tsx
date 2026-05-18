/**
 * Tests for the small presentational primitives shared between the
 * messaging-related settings pages.
 */

import { render, screen } from "@testing-library/react";
import { Phone } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ChecklistRow, FlowStep, ReadyChip, StatusBadge } from "./messaging-settings-shared";

describe("StatusBadge", () => {
  it.each([
    ["DELIVERED", "Entregado"],
    ["FAILED", "Fallido"],
    ["PENDING", "Pendiente"],
    ["PLAYED", "Reproducido"],
    ["READ", "Leído"],
    ["SENT", "Enviado"],
  ] as const)("maps the %s status to the localised label '%s'", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("ReadyChip", () => {
  it("uses the trueLabel when value is true", () => {
    render(<ReadyChip value={true} />);
    expect(screen.getByText("Listo")).toBeInTheDocument();
  });

  it("uses the falseLabel when value is false", () => {
    render(<ReadyChip value={false} />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("honours custom labels", () => {
    render(<ReadyChip value={true} trueLabel="OK" falseLabel="NO" />);
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText("NO")).not.toBeInTheDocument();
  });
});

describe("ChecklistRow", () => {
  it("renders the title, description, and a Listo chip when ready", () => {
    render(
      <ChecklistRow
        title="Webhook configurado"
        description="Apunta a /api/wa/webhook"
        icon={Phone}
        ready={true}
      />
    );
    expect(screen.getByText("Webhook configurado")).toBeInTheDocument();
    expect(screen.getByText("Apunta a /api/wa/webhook")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
  });

  it("renders a Pendiente chip when ready is false", () => {
    render(<ChecklistRow title="x" description="y" icon={Phone} ready={false} />);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });
});

describe("FlowStep", () => {
  it("renders the step number, title, and body", () => {
    render(
      <FlowStep
        step="Paso 1"
        title="Conectar Meta"
        body="Obtén un access token de larga duración"
        icon={Phone}
      />
    );
    expect(screen.getByText("Paso 1")).toBeInTheDocument();
    expect(screen.getByText("Conectar Meta")).toBeInTheDocument();
    expect(screen.getByText("Obtén un access token de larga duración")).toBeInTheDocument();
  });
});
