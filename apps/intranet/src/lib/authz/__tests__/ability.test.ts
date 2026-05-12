import { describe, expect, it } from "vitest";
import { ability, updateAbility } from "../ability";

describe("updateAbility", () => {
  it("allows actions after updating rules", () => {
    updateAbility([{ action: "read", subject: "Patient" }]);
    expect(ability.can("read", "Patient")).toBe(true);
    expect(ability.can("write", "Patient")).toBe(false);
  });

  it("clears previous rules on update", () => {
    updateAbility([{ action: "delete", subject: "Invoice" }]);
    expect(ability.can("delete", "Invoice")).toBe(true);
    // Previous Patient read should no longer apply after full replacement
    updateAbility([]);
    expect(ability.can("delete", "Invoice")).toBe(false);
    expect(ability.can("read", "Patient")).toBe(false);
  });

  it("supports multiple rules", () => {
    updateAbility([
      { action: "read", subject: "all" },
      { action: "manage", subject: "Dashboard" },
    ]);
    expect(ability.can("read", "Appointment")).toBe(true);
    expect(ability.can("manage", "Dashboard")).toBe(true);
  });

  it("denies actions not in rules even when similar subjects allowed", () => {
    updateAbility([{ action: "read", subject: "Patient" }]);
    expect(ability.can("read", "Patient")).toBe(true);
    expect(ability.can("delete", "Patient")).toBe(false);
    expect(ability.can("read", "Invoice")).toBe(false);
  });
});
