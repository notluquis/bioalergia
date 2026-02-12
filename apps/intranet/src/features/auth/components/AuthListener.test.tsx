import type { RawRuleOf } from "@casl/ability";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAbility } from "@/lib/authz/ability";
import type { AuthSessionData } from "../types";
import { AuthListener } from "./AuthListener";

const updateAbilityMock = vi.hoisted(() => vi.fn());
const setNotificationScopeMock = vi.hoisted(() => vi.fn());
const mockAuthState = vi.hoisted(() => ({
  impersonatedRole: null as null | {
    permissions: { permission: { action: string; subject: string } }[];
  },
  sessionData: undefined as undefined | AuthSessionData | null,
}));

vi.mock("@/lib/authz/ability", () => ({
  updateAbility: updateAbilityMock,
}));

vi.mock("@/features/notifications/store/use-notification-store", () => ({
  setNotificationScope: setNotificationScopeMock,
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => mockAuthState,
}));

describe("AuthListener", () => {
  beforeEach(() => {
    updateAbilityMock.mockClear();
    setNotificationScopeMock.mockClear();
    mockAuthState.impersonatedRole = null;
    mockAuthState.sessionData = undefined;
  });

  it("does not update ability while session is undefined and no impersonation", async () => {
    render(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).not.toHaveBeenCalled());
  });

  it("updates ability from impersonated role and skips session rules", async () => {
    mockAuthState.impersonatedRole = {
      permissions: [{ permission: { action: "read", subject: "TimesheetList" } }],
    };
    render(<AuthListener />);
    await waitFor(() =>
      expect(updateAbilityMock).toHaveBeenCalledWith([
        { action: "read", subject: "TimesheetList" },
      ]),
    );
  });

  it("avoids redundant updates when rules have not changed", async () => {
    const abilityRules: RawRuleOf<AppAbility>[] = [{ action: "read", subject: "Report" }];
    mockAuthState.sessionData = {
      abilityRules,
      permissionVersion: 1,
      user: null,
    };
    const { rerender } = render(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).toHaveBeenCalledTimes(1));

    rerender(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).toHaveBeenCalledTimes(1));
  });

  it("clears ability when sessionData is null", async () => {
    mockAuthState.sessionData = null;
    render(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).toHaveBeenCalledWith([]));
    await waitFor(() => expect(setNotificationScopeMock).toHaveBeenCalledWith(null));
  });

  it("updates ability when rules change", async () => {
    const initialRules: RawRuleOf<AppAbility>[] = [{ action: "read", subject: "Report" }];
    const nextRules: RawRuleOf<AppAbility>[] = [{ action: "update", subject: "Report" }];
    mockAuthState.sessionData = {
      abilityRules: initialRules,
      permissionVersion: 1,
      user: null,
    };
    const { rerender } = render(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).toHaveBeenCalledTimes(1));
    expect(updateAbilityMock).toHaveBeenLastCalledWith(initialRules);

    mockAuthState.sessionData = {
      abilityRules: nextRules,
      permissionVersion: 2,
      user: null,
    };
    rerender(<AuthListener />);
    await waitFor(() => expect(updateAbilityMock).toHaveBeenCalledTimes(2));
    expect(updateAbilityMock).toHaveBeenLastCalledWith(nextRules);
  });
});
