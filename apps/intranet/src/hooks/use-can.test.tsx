/**
 * Tests for `useCan` — thin wrapper over the AbilityProvider context.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AbilityProvider } from "../lib/authz/AbilityProvider";
import { updateAbility } from "../lib/authz/ability";
import { useCan } from "./use-can";

describe("useCan", () => {
  it("returns false when the current ability denies the action", () => {
    updateAbility([]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AbilityProvider>{children}</AbilityProvider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(result.current.can("read", "Anything")).toBe(false);
  });

  it("returns true when the ability grants the action/subject", () => {
    updateAbility([{ action: "read", subject: "Report" }]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AbilityProvider>{children}</AbilityProvider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(result.current.can("read", "Report")).toBe(true);
    expect(result.current.can("update", "Report")).toBe(false);
  });

  it("exposes the underlying ability instance", () => {
    updateAbility([{ action: "read", subject: "Report" }]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AbilityProvider>{children}</AbilityProvider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    expect(typeof result.current.ability.can).toBe("function");
  });

  it("forwards the optional field arg to ability.can", () => {
    updateAbility([{ action: "read", subject: "Report" }]);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AbilityProvider>{children}</AbilityProvider>
    );
    const { result } = renderHook(() => useCan(), { wrapper });
    // With no field-level rules, can(action, subject, field) still returns
    // true when the broad rule grants the action on the subject.
    expect(result.current.can("read", "Report", "any-field")).toBe(true);
  });
});
