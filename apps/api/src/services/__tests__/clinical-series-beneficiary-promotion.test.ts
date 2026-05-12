import { describe, expect, it } from "vitest";
import { shouldPromoteBeneficiaryToPatientIdentity } from "../clinical-series.ts";

describe("clinical series beneficiary to patient promotion", () => {
  it("promotes boleta identity when it matches the patient name", () => {
    expect(
      shouldPromoteBeneficiaryToPatientIdentity({
        beneficiaryName: "Mingtsu Leonardo Chang Liu",
        patientName: "mingtsu leonardo chang liu",
      })
    ).toBe(true);
  });

  it("does not promote boleta identity when it belongs to a different person", () => {
    expect(
      shouldPromoteBeneficiaryToPatientIdentity({
        beneficiaryName: "Luis Hormazabal Saez",
        patientName: "emilio sabath saez",
      })
    ).toBe(false);
  });

  it("falls back to DTE names when beneficiary name is missing", () => {
    expect(
      shouldPromoteBeneficiaryToPatientIdentity({
        beneficiaryName: null,
        dteClientNames: ["MINGTSU LEONARDO CHANG LIU"],
        patientName: "mingtsu leonardo chang liu",
      })
    ).toBe(true);
  });
});
