/**
 * Tests for patient-campaigns status constants. Guards against
 * accidental deletion of a status / mismatched label or color mapping —
 * a missing entry would render `undefined` in the recipient chip.
 */

import { describe, expect, it } from "vitest";

import {
  PATIENT_CAMPAIGN_STATUSES,
  PATIENT_CAMPAIGN_STATUS_COLORS,
  PATIENT_CAMPAIGN_STATUS_LABELS,
} from "./types";

describe("PATIENT_CAMPAIGN_STATUSES", () => {
  it("declares the seven recipient lifecycle statuses in canonical order", () => {
    expect(PATIENT_CAMPAIGN_STATUSES).toEqual([
      "PENDING",
      "SENT",
      "INFO_REQUESTED",
      "IN_NEGOTIATION",
      "ACCEPTED",
      "DISMISSED",
      "NO_RESPONSE",
    ]);
  });

  it("each status has a non-empty Spanish label", () => {
    for (const s of PATIENT_CAMPAIGN_STATUSES) {
      expect(PATIENT_CAMPAIGN_STATUS_LABELS[s]).toMatch(/\S/);
    }
  });

  it("each status has a HeroUI-compatible color token", () => {
    const valid = ["default", "accent", "warning", "success", "danger"];
    for (const s of PATIENT_CAMPAIGN_STATUSES) {
      expect(valid).toContain(PATIENT_CAMPAIGN_STATUS_COLORS[s]);
    }
  });

  it("uses success for ACCEPTED and danger for DISMISSED (semantic accuracy)", () => {
    expect(PATIENT_CAMPAIGN_STATUS_COLORS.ACCEPTED).toBe("success");
    expect(PATIENT_CAMPAIGN_STATUS_COLORS.DISMISSED).toBe("danger");
  });
});
