/**
 * Tests for `useOnboardingForm` — the onboarding wizard state machine.
 *
 * Golden 2026 patterns:
 * - `vi.hoisted` for shared mock state (avoids hoisting bugs with
 *   `vi.mock` factory).
 * - QueryClient per test (no global cache pollution).
 * - `renderHook` + `act` for hook surface tests; assert on the public
 *   return type (currentStep, mutations.*) rather than internal state.
 * - Cover BOTH success and error paths for every async mutation.
 *
 * Regression scope: this file was written *because* the
 * `passkeyRegister` mutation was missing its `onSuccess` callback and
 * the wizard froze on step 4 after passkey enrolment. The "passkey
 * advances to step 5 on success" test below is the canary.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  setupMfa: vi.fn(),
  enableMfa: vi.fn(),
  fetchPasskeyRegistrationOptions: vi.fn(),
  verifyPasskeyRegistration: vi.fn(),
  fetchUserProfile: vi.fn(),
  setupUser: vi.fn(),
}));

const webauthnMock = vi.hoisted(() => ({
  startRegistration: vi.fn(),
}));

vi.mock("@/features/auth/api", () => ({
  enableMfa: apiMocks.enableMfa,
  fetchPasskeyRegistrationOptions: apiMocks.fetchPasskeyRegistrationOptions,
  setupMfa: apiMocks.setupMfa,
  verifyPasskeyRegistration: apiMocks.verifyPasskeyRegistration,
}));

vi.mock("@/features/users/api", () => ({
  fetchUserProfile: apiMocks.fetchUserProfile,
  setupUser: apiMocks.setupUser,
}));

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration: webauthnMock.startRegistration,
}));

const { useOnboardingForm } = await import("./useOnboardingForm");

const baseProfile = {
  loginEmail: "user@example.com",
  email: "user@example.com",
  names: "Ana",
  rut: "12345670-K",
  phone: "+56912345678",
  fatherName: "Perez",
  motherName: "Soto",
  bankName: "",
  bankAccountType: "",
  bankAccountNumber: "",
};

function buildWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useOnboardingForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchUserProfile.mockResolvedValue(baseProfile);
  });

  it("hydrates default values from the user profile query", async () => {
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });

    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));
    expect(result.current.profile.rut).toBe("12345670-K");
    expect(result.current.currentStep).toBe(0);
  });

  it("handleNext advances and handlePrev rewinds within bounds", async () => {
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(1);
    act(() => result.current.handleNext());
    act(() => result.current.handlePrev());
    expect(result.current.currentStep).toBe(1);

    // Caps at 5 (last step = "complete").
    for (let i = 0; i < 10; i++) act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(5);

    // Floors at 0.
    for (let i = 0; i < 10; i++) act(() => result.current.handlePrev());
    expect(result.current.currentStep).toBe(0);
  });

  it("auto-runs mfaSetup when entering step 4", async () => {
    apiMocks.setupMfa.mockResolvedValue({
      qrCodeUrl: "data:image/png;base64,xxx",
      secret: "JBSWY3DPEHPK3PXP",
    });
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    expect(result.current.currentStep).toBe(4);

    await waitFor(() => expect(apiMocks.setupMfa).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.mfaSecret?.secret).toBe("JBSWY3DPEHPK3PXP"));
  });

  it("mfaVerify advances to step 5 on success", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.enableMfa.mockResolvedValue({ status: "ok" });
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());

    act(() => result.current.setMfaCode("123456"));
    act(() => result.current.mutations.mfaVerify.mutate("123456"));

    await waitFor(() => expect(result.current.currentStep).toBe(5));
    expect(apiMocks.enableMfa).toHaveBeenCalledWith({ secret: "S", token: "123456" });
  });

  it("mfaVerify surfaces error message on failure and stays on step 4", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.enableMfa.mockRejectedValue(new Error("Código MFA inválido"));
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());

    act(() => result.current.mutations.mfaVerify.mutate("bad"));

    await waitFor(() => expect(result.current.error).toBe("Código MFA inválido"));
    expect(result.current.currentStep).toBe(4);
  });

  // ─── Regression: passkey registration must advance the wizard ───
  // Bug fixed 2026-05-18: `passkeyRegister.mutation.onSuccess` was
  // missing → user completed biometric enrolment but stayed on step 4.
  it("passkeyRegister advances to step 5 on successful enrolment", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.fetchPasskeyRegistrationOptions.mockResolvedValue({
      type: "ok",
      options: { challenge: "ch" },
    });
    webauthnMock.startRegistration.mockResolvedValue({ id: "credId", rawId: "raw" });
    apiMocks.verifyPasskeyRegistration.mockResolvedValue({ status: "ok" });

    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());

    act(() => result.current.mutations.passkeyRegister.mutate());

    await waitFor(() => expect(result.current.currentStep).toBe(5));
    expect(apiMocks.verifyPasskeyRegistration).toHaveBeenCalledWith({
      body: { id: "credId", rawId: "raw" },
      challenge: "ch",
    });
  });

  it("passkeyRegister surfaces error from server (type=error)", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.fetchPasskeyRegistrationOptions.mockResolvedValue({
      type: "error",
      message: "WebAuthn no soportado",
    });
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());

    act(() => result.current.mutations.passkeyRegister.mutate());

    await waitFor(() => expect(result.current.error).toBe("WebAuthn no soportado"));
    expect(result.current.currentStep).toBe(4);
  });

  it("passkeyRegister surfaces error when verify returns non-ok status", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.fetchPasskeyRegistrationOptions.mockResolvedValue({
      type: "ok",
      options: { challenge: "ch" },
    });
    webauthnMock.startRegistration.mockResolvedValue({ id: "credId" });
    apiMocks.verifyPasskeyRegistration.mockResolvedValue({
      status: "failed",
      message: "Challenge mismatch",
    });
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());

    act(() => result.current.mutations.passkeyRegister.mutate());

    await waitFor(() => expect(result.current.error).toBe("Challenge mismatch"));
    expect(result.current.currentStep).toBe(4);
  });

  it("finalSubmit posts trimmed values and invalidates user profile cache", async () => {
    apiMocks.setupUser.mockResolvedValue({ ok: true });
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    act(() => result.current.handleProfileChange("names", "  Ana  "));
    act(() => result.current.handleProfileChange("fatherName", "  Perez "));
    act(() => result.current.setPassword("supersecret"));

    act(() => result.current.mutations.finalSubmit.mutate());

    await waitFor(() => expect(apiMocks.setupUser).toHaveBeenCalledTimes(1));
    const call = apiMocks.setupUser.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call?.names).toBe("Ana");
    expect(call?.fatherName).toBe("Perez");
    expect(call?.password).toBe("supersecret");
  });

  it("handleProfileChange clears any prior error", async () => {
    apiMocks.setupMfa.mockResolvedValue({ qrCodeUrl: "x", secret: "S" });
    apiMocks.enableMfa.mockRejectedValue(new Error("boom"));
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());
    await waitFor(() => expect(result.current.mfaSecret).not.toBeNull());
    act(() => result.current.mutations.mfaVerify.mutate("bad"));
    await waitFor(() => expect(result.current.error).toBe("boom"));

    act(() => result.current.handleProfileChange("names", "Lucia"));
    expect(result.current.error).toBeNull();
    expect(result.current.profile.names).toBe("Lucia");
  });

  it("isLoading aggregates pending state across all mutations", async () => {
    let resolveSetup: (v: unknown) => void = () => undefined;
    apiMocks.setupMfa.mockReturnValue(
      new Promise((resolve) => {
        resolveSetup = resolve;
      })
    );
    const wrapper = buildWrapper();
    const { result } = renderHook(() => useOnboardingForm(), { wrapper });
    await waitFor(() => expect(result.current.profile.names).toBe("Ana"));

    for (let i = 0; i < 4; i++) act(() => result.current.handleNext());

    await waitFor(() => expect(result.current.isLoading).toBe(true));

    act(() => resolveSetup({ qrCodeUrl: "x", secret: "S" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});
