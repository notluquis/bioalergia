/**
 * Tests for users `api.ts` orpc wrappers — invite, role assignment,
 * MFA toggle, status updates, passkey/password resets, profile update.
 *
 * Golden 2026 patterns: `vi.hoisted` shared mock factory, module-boundary
 * mock of the orpc client only, error-mapping via `toUsersApiError`
 * (re-thrown as ApiError). Real CL RUTs used in payloads.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const orpcMocks = vi.hoisted(() => ({
  list: vi.fn(),
  profile: vi.fn(),
  invite: vi.fn(),
  setup: vi.fn(),
  delete: vi.fn(),
  deletePasskey: vi.fn(),
  resetPassword: vi.fn(),
  toggleMfa: vi.fn(),
  updateRole: vi.fn(),
  updateStatus: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock("./orpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./orpc")>();
  return {
    usersORPCClient: orpcMocks,
    toUsersApiError: actual.toUsersApiError,
  };
});

const {
  deleteUser,
  deleteUserPasskey,
  fetchUserProfile,
  fetchUsers,
  inviteUser,
  resetUserPassword,
  setupUser,
  toggleUserMfa,
  updateUserRole,
  updateUserStatus,
  updateUserProfile,
} = await import("./api");
const { ApiError } = await import("@/lib/api-client");

// Valid Chilean RUTs (verifier digit correct).
const VALID_RUT_1 = "11.111.111-1";
const VALID_RUT_2 = "12.345.678-5";

describe("users/api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchUsers (list)", () => {
    it("parses and returns users array", async () => {
      orpcMocks.list.mockResolvedValue({
        users: [
          { id: 1, names: "Ana", role: "admin" },
          { id: 2, names: "Beto", role: "doctor" },
        ],
      });
      const res = await fetchUsers();
      expect(orpcMocks.list).toHaveBeenCalledWith({});
      expect(res).toHaveLength(2);
    });

    it("throws ApiError on schema-invalid response", async () => {
      orpcMocks.list.mockResolvedValue({ wrong: "shape" });
      await expect(fetchUsers()).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps network errors", async () => {
      orpcMocks.list.mockRejectedValue(new Error("boom"));
      await expect(fetchUsers()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("fetchUserProfile", () => {
    it("unwraps { data } envelope", async () => {
      orpcMocks.profile.mockResolvedValue({ data: { id: 5, names: "Yo" } });
      const res = await fetchUserProfile();
      expect(orpcMocks.profile).toHaveBeenCalledWith({});
      expect(res).toEqual({ id: 5, names: "Yo" });
    });

    it("wraps errors as ApiError", async () => {
      orpcMocks.profile.mockRejectedValue(new Error("401"));
      await expect(fetchUserProfile()).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("inviteUser", () => {
    it("forwards payload and parses { tempPassword, userId }", async () => {
      orpcMocks.invite.mockResolvedValue({ tempPassword: "Temp1234!", userId: 99 });
      const payload = {
        email: "nuevo@bioalergia.cl",
        position: "Enfermera",
        role: "nurse",
        rut: VALID_RUT_1,
        names: "Carla",
        mfaEnforced: true,
      };
      const res = await inviteUser(payload);
      expect(orpcMocks.invite).toHaveBeenCalledWith(payload);
      expect(res).toEqual({ tempPassword: "Temp1234!", userId: 99 });
    });

    it("accepts response without tempPassword (sent via email)", async () => {
      orpcMocks.invite.mockResolvedValue({ userId: 100 });
      const res = await inviteUser({
        email: "a@b.cl",
        position: "x",
        role: "y",
      });
      expect(res.userId).toBe(100);
      expect(res.tempPassword).toBeUndefined();
    });

    it("wraps invite errors", async () => {
      orpcMocks.invite.mockRejectedValue(new Error("email exists"));
      await expect(
        inviteUser({ email: "a@b.cl", position: "x", role: "y" })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("setupUser", () => {
    it("forwards full setup payload with valid RUT", async () => {
      orpcMocks.setup.mockResolvedValue({ status: "ok" });
      const payload = {
        names: "Diego Soto",
        password: "Strong!Passw0rd",
        rut: VALID_RUT_2,
        phone: "+56911112222",
      };
      await setupUser(payload);
      expect(orpcMocks.setup).toHaveBeenCalledWith(payload);
    });

    it("wraps setup errors", async () => {
      orpcMocks.setup.mockRejectedValue(new Error("rut taken"));
      await expect(
        setupUser({ names: "x", password: "Strong!1Aaaa", rut: VALID_RUT_1 })
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("updateUserRole (role assignment)", () => {
    it("forwards { id, role }", async () => {
      orpcMocks.updateRole.mockResolvedValue({ status: "ok" });
      await updateUserRole(7, "admin");
      expect(orpcMocks.updateRole).toHaveBeenCalledWith({ id: 7, role: "admin" });
    });

    it("wraps errors (e.g. forbidden / impersonation gate)", async () => {
      orpcMocks.updateRole.mockRejectedValue(new Error("forbidden"));
      await expect(updateUserRole(7, "admin")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("updateUserStatus", () => {
    it.each(["ACTIVE", "PENDING_SETUP", "SUSPENDED"] as const)(
      "forwards status=%s",
      async (status) => {
        orpcMocks.updateStatus.mockResolvedValue({ status: "ok" });
        await updateUserStatus(3, status);
        expect(orpcMocks.updateStatus).toHaveBeenCalledWith({ id: 3, status });
      }
    );

    it("wraps errors", async () => {
      orpcMocks.updateStatus.mockRejectedValue(new Error("invalid transition"));
      await expect(updateUserStatus(3, "SUSPENDED")).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("toggleUserMfa (MFA reset)", () => {
    it("forwards id + enabled=true and resolves on status=ok", async () => {
      orpcMocks.toggleMfa.mockResolvedValue({ status: "ok" });
      await toggleUserMfa(11, true);
      expect(orpcMocks.toggleMfa).toHaveBeenCalledWith({ id: 11, enabled: true });
    });

    it("forwards enabled=false (reset / disable)", async () => {
      orpcMocks.toggleMfa.mockResolvedValue({ status: "ok" });
      await toggleUserMfa(11, false);
      expect(orpcMocks.toggleMfa).toHaveBeenCalledWith({ id: 11, enabled: false });
    });

    it("throws ApiError when status != ok (with server-provided message)", async () => {
      orpcMocks.toggleMfa.mockResolvedValue({ status: "error", message: "TOTP not configured" });
      await expect(toggleUserMfa(11, true)).rejects.toBeInstanceOf(ApiError);
      await expect(toggleUserMfa(11, true)).rejects.toThrow(/TOTP not configured/);
    });

    it("throws ApiError when status != ok (default message)", async () => {
      orpcMocks.toggleMfa.mockResolvedValue({ status: "fail" });
      await expect(toggleUserMfa(11, true)).rejects.toBeInstanceOf(ApiError);
    });

    it("wraps network errors", async () => {
      orpcMocks.toggleMfa.mockRejectedValue(new Error("boom"));
      await expect(toggleUserMfa(11, true)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("password / passkey reset", () => {
    it("resetUserPassword returns tempPassword string", async () => {
      orpcMocks.resetPassword.mockResolvedValue({ tempPassword: "Nuevo!Pass1" });
      const res = await resetUserPassword(42);
      expect(orpcMocks.resetPassword).toHaveBeenCalledWith({ id: 42 });
      expect(res).toBe("Nuevo!Pass1");
    });

    it("resetUserPassword wraps errors", async () => {
      orpcMocks.resetPassword.mockRejectedValue(new Error("403"));
      await expect(resetUserPassword(42)).rejects.toBeInstanceOf(ApiError);
    });

    it("deleteUserPasskey forwards id", async () => {
      orpcMocks.deletePasskey.mockResolvedValue(undefined);
      await deleteUserPasskey(42);
      expect(orpcMocks.deletePasskey).toHaveBeenCalledWith({ id: 42 });
    });

    it("deleteUserPasskey wraps errors", async () => {
      orpcMocks.deletePasskey.mockRejectedValue(new Error("not found"));
      await expect(deleteUserPasskey(42)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("deleteUser", () => {
    it("forwards id", async () => {
      orpcMocks.delete.mockResolvedValue(undefined);
      await deleteUser(99);
      expect(orpcMocks.delete).toHaveBeenCalledWith({ id: 99 });
    });

    it("wraps FK / cascade errors", async () => {
      orpcMocks.delete.mockRejectedValue(new Error("FK violation"));
      await expect(deleteUser(99)).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe("updateUserProfile", () => {
    const baseProfile = {
      names: "Ana Pérez",
      position: "Enfermera",
      rut: VALID_RUT_1,
      notificationEmail: "ana@bioalergia.cl",
    };

    it("forwards parsed payload to orpc updateProfile", async () => {
      orpcMocks.updateProfile.mockResolvedValue(undefined);
      await updateUserProfile(5, baseProfile);
      expect(orpcMocks.updateProfile).toHaveBeenCalledWith({
        id: 5,
        payload: baseProfile,
      });
    });

    it("accepts nullable + optional fields", async () => {
      orpcMocks.updateProfile.mockResolvedValue(undefined);
      const payload = {
        ...baseProfile,
        address: null,
        bankAccountNumber: null,
        loginEmail: null,
        phone: "+56999998888",
        mfaEnforced: true,
      };
      await updateUserProfile(5, payload);
      expect(orpcMocks.updateProfile).toHaveBeenCalledWith({ id: 5, payload });
    });

    it("rejects (throws zod error) when notificationEmail is missing", async () => {
      await expect(
        updateUserProfile(5, {
          names: "x",
          position: "y",
          rut: VALID_RUT_1,
          // notificationEmail missing
        } as never)
      ).rejects.toThrow();
      expect(orpcMocks.updateProfile).not.toHaveBeenCalled();
    });

    it("rejects when notificationEmail is invalid", async () => {
      await expect(
        updateUserProfile(5, { ...baseProfile, notificationEmail: "not-an-email" })
      ).rejects.toThrow();
      expect(orpcMocks.updateProfile).not.toHaveBeenCalled();
    });

    it("wraps server-side errors as ApiError", async () => {
      orpcMocks.updateProfile.mockRejectedValue(new Error("forbidden"));
      await expect(updateUserProfile(5, baseProfile)).rejects.toBeInstanceOf(ApiError);
    });
  });
});
