import { describe, expect, it } from "vitest";

import {
  DANGEROUS_PERMISSION_PATTERNS,
  buildDangerousPermissionsWhereClause,
  filterSafePermissions,
  isDangerousPermission,
} from "../permission-validator";

describe("permission-validator", () => {
  describe("DANGEROUS_PERMISSION_PATTERNS", () => {
    it("includes the manage action with no subject", () => {
      const noSubject = DANGEROUS_PERMISSION_PATTERNS.find(
        (p) => p.action === "manage" && p.subject === undefined,
      );
      expect(noSubject).toBeDefined();
    });

    it("includes the manage action with subject 'all'", () => {
      const manageAll = DANGEROUS_PERMISSION_PATTERNS.find(
        (p) => p.action === "manage" && p.subject === "all",
      );
      expect(manageAll).toBeDefined();
    });

    it("has at least two patterns", () => {
      expect(DANGEROUS_PERMISSION_PATTERNS.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("isDangerousPermission", () => {
    it("returns true for manage on any subject", () => {
      expect(isDangerousPermission("manage", "users")).toBe(true);
    });

    it("returns true for manage:all", () => {
      expect(isDangerousPermission("manage", "all")).toBe(true);
    });

    it("returns true for manage on an arbitrary subject", () => {
      expect(isDangerousPermission("manage", "events")).toBe(true);
      expect(isDangerousPermission("manage", "invoices")).toBe(true);
    });

    it("returns false for safe CRUD actions", () => {
      expect(isDangerousPermission("create", "users")).toBe(false);
      expect(isDangerousPermission("read", "users")).toBe(false);
      expect(isDangerousPermission("update", "users")).toBe(false);
      expect(isDangerousPermission("delete", "users")).toBe(false);
    });

    it("returns false for safe actions on 'all' subject", () => {
      expect(isDangerousPermission("read", "all")).toBe(false);
      expect(isDangerousPermission("create", "all")).toBe(false);
    });

    it("returns false for non-standard but safe actions", () => {
      expect(isDangerousPermission("export", "reports")).toBe(false);
      expect(isDangerousPermission("view", "dashboard")).toBe(false);
    });

    it("is case-sensitive (only lowercase 'manage' is dangerous)", () => {
      // The pattern matches exactly 'manage', not 'MANAGE' or 'Manage'
      expect(isDangerousPermission("MANAGE", "users")).toBe(false);
      expect(isDangerousPermission("Manage", "users")).toBe(false);
    });
  });

  describe("filterSafePermissions", () => {
    it("removes permissions with manage action", () => {
      const permissions = [
        { action: "manage", subject: "users" },
        { action: "read", subject: "users" },
        { action: "manage", subject: "all" },
        { action: "create", subject: "events" },
      ];
      const result = filterSafePermissions(permissions);
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.action !== "manage")).toBe(true);
    });

    it("returns all permissions when none are dangerous", () => {
      const permissions = [
        { action: "read", subject: "users" },
        { action: "create", subject: "events" },
        { action: "update", subject: "invoices" },
        { action: "delete", subject: "shipments" },
      ];
      const result = filterSafePermissions(permissions);
      expect(result).toHaveLength(4);
    });

    it("returns empty array when all permissions are dangerous", () => {
      const permissions = [
        { action: "manage", subject: "users" },
        { action: "manage", subject: "all" },
        { action: "manage", subject: "events" },
      ];
      const result = filterSafePermissions(permissions);
      expect(result).toHaveLength(0);
    });

    it("returns empty array for empty input", () => {
      expect(filterSafePermissions([])).toHaveLength(0);
    });

    it("preserves extra properties on permission objects", () => {
      const permissions = [
        { action: "read", subject: "users", id: 1, conditions: { tenantId: "123" } },
        { action: "manage", subject: "all", id: 2, conditions: {} },
      ];
      const result = filterSafePermissions(permissions);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].conditions).toEqual({ tenantId: "123" });
    });

    it("handles single safe permission", () => {
      const permissions = [{ action: "read", subject: "reports" }];
      expect(filterSafePermissions(permissions)).toHaveLength(1);
    });

    it("handles single dangerous permission", () => {
      const permissions = [{ action: "manage", subject: "reports" }];
      expect(filterSafePermissions(permissions)).toHaveLength(0);
    });
  });

  describe("buildDangerousPermissionsWhereClause", () => {
    it("returns an object with an OR key", () => {
      const clause = buildDangerousPermissionsWhereClause();
      expect(clause).toHaveProperty("OR");
      expect(Array.isArray(clause.OR)).toBe(true);
    });

    it("includes at least one condition for manage without subject", () => {
      const clause = buildDangerousPermissionsWhereClause();
      // Pattern without subject → { action: "manage" } (no AND wrapper)
      const simpleManage = clause.OR.find(
        (c) =>
          "action" in c && (c as { action: string }).action === "manage" && !("AND" in c),
      );
      expect(simpleManage).toBeDefined();
    });

    it("includes at least one condition for manage:all using AND", () => {
      const clause = buildDangerousPermissionsWhereClause();
      const manageAll = clause.OR.find(
        (c) =>
          "AND" in c &&
          Array.isArray((c as { AND: unknown[] }).AND) &&
          (c as { AND: Array<{ action?: string; subject?: string }> }).AND.some(
            (a) => a.action === "manage",
          ) &&
          (c as { AND: Array<{ action?: string; subject?: string }> }).AND.some(
            (a) => a.subject === "all",
          ),
      );
      expect(manageAll).toBeDefined();
    });

    it("returns as many OR conditions as there are patterns", () => {
      const clause = buildDangerousPermissionsWhereClause();
      expect(clause.OR).toHaveLength(DANGEROUS_PERMISSION_PATTERNS.length);
    });
  });
});
