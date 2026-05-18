/**
 * Tests for outreach label/color dictionaries. These guard against
 * accidental key deletions that would leave the UI rendering `undefined`
 * for a status/dependencia chip.
 */

import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  DEPENDENCIA_LABELS,
  ESTADO_COLOR,
  ESTADO_LABELS,
  INTERACCION_LABELS,
  PRIORIDAD_COLOR,
  PRIORIDAD_LABELS,
} from "./labels";

describe("ESTADO_LABELS", () => {
  it("covers every prospecting status with non-empty Spanish label", () => {
    const expected = [
      "SIN_CONTACTAR",
      "CONTACTADO",
      "SIN_RESPUESTA",
      "RESPONDIO_INTERES",
      "RESPONDIO_MAS_INFO",
      "RESPONDIO_DESISTIO",
      "REUNION_AGENDADA",
      "CONVENIO_FIRMADO",
      "DESCARTADO",
    ];
    expect(Object.keys(ESTADO_LABELS).sort()).toEqual([...expected].sort());
    for (const key of expected) {
      expect(ESTADO_LABELS[key as keyof typeof ESTADO_LABELS]).toMatch(/\S/);
    }
  });

  it("pairs every status with a HeroUI semantic color", () => {
    for (const key of Object.keys(ESTADO_LABELS)) {
      const color = ESTADO_COLOR[key as keyof typeof ESTADO_COLOR];
      expect(["default", "warning", "success", "danger", "accent"]).toContain(color);
    }
  });

  it("uses danger color for terminal-negative states", () => {
    expect(ESTADO_COLOR.RESPONDIO_DESISTIO).toBe("danger");
    expect(ESTADO_COLOR.DESCARTADO).toBe("danger");
  });

  it("uses success color for closed-won states", () => {
    expect(ESTADO_COLOR.CONVENIO_FIRMADO).toBe("success");
    expect(ESTADO_COLOR.REUNION_AGENDADA).toBe("success");
  });
});

describe("DEPENDENCIA_LABELS", () => {
  it("maps every MINEDUC dependencia type to a short Spanish label", () => {
    expect(DEPENDENCIA_LABELS.MUNICIPAL).toBe("Municipal");
    expect(DEPENDENCIA_LABELS.PARTICULAR_SUBVENCIONADO).toBe("Part. Subvencionado");
    expect(DEPENDENCIA_LABELS.SLEP).toBe("SLEP");
    expect(DEPENDENCIA_LABELS.OTRO).toBe("Otro");
  });
});

describe("PRIORIDAD_LABELS and PRIORIDAD_COLOR", () => {
  it("covers ALTA/MEDIA/BAJA with consistent color severity", () => {
    expect(PRIORIDAD_LABELS).toEqual({ ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" });
    expect(PRIORIDAD_COLOR.ALTA).toBe("danger");
    expect(PRIORIDAD_COLOR.MEDIA).toBe("warning");
    expect(PRIORIDAD_COLOR.BAJA).toBe("default");
  });
});

describe("INTERACCION_LABELS", () => {
  it("includes WhatsApp + email + meeting interactions", () => {
    expect(INTERACCION_LABELS.WHATSAPP).toBe("WhatsApp");
    expect(INTERACCION_LABELS.EMAIL_ENVIADO).toBe("Email enviado");
    expect(INTERACCION_LABELS.REUNION_ONLINE).toBe("Reunión online");
  });
});

describe("CAMPAIGN_STATUS_LABELS and DELIVERY_STATUS_LABELS", () => {
  it("campaign status labels are Spanish-localized", () => {
    expect(CAMPAIGN_STATUS_LABELS.BORRADOR).toBe("Borrador");
    expect(CAMPAIGN_STATUS_LABELS.ENVIANDO).toBe("Enviando");
  });

  it("delivery statuses include open + bounce tracking", () => {
    expect(DELIVERY_STATUS_LABELS.ABIERTO).toBe("Abierto");
    expect(DELIVERY_STATUS_LABELS.REBOTADO).toBe("Rebotado");
    expect(DELIVERY_STATUS_LABELS.PENDIENTE).toBe("Pendiente");
  });
});
