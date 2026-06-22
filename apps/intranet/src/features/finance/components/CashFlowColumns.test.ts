import { describe, expect, it } from "vitest";
import { shouldShowOfficialWithdrawDetails } from "./CashFlowColumns";

describe("shouldShowOfficialWithdrawDetails", () => {
  it("shows official withdrawal details when only the official RUT differs", () => {
    expect(
      shouldShowOfficialWithdrawDetails({
        manualAccountLine: "Banco Estado · Cuenta vista · ****1234",
        manualIdentificationNumber: "111111111",
        manualName: "Retiro manual",
        officialIdentificationNumber: "222222222",
        officialName: "Retiro manual",
        withdrawAccountLine: "Banco Estado · Cuenta vista · ****1234",
      })
    ).toBe(true);
  });

  it("hides official withdrawal details when all rendered official fields match", () => {
    expect(
      shouldShowOfficialWithdrawDetails({
        manualAccountLine: "Banco Estado · Cuenta vista · ****1234",
        manualIdentificationNumber: "111111111",
        manualName: "Retiro manual",
        officialIdentificationNumber: "111111111",
        officialName: "Retiro manual",
        withdrawAccountLine: "Banco Estado · Cuenta vista · ****1234",
      })
    ).toBe(false);
  });
});
