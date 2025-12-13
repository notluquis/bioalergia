import express from "express";
import { asyncHandler, authenticate } from "../lib/index.js";
import { authorize } from "../middleware/authorize.js";
import { listRoles, createRole, updateRole, deleteRole, assignPermissionsToRole } from "../services/roles.js";
import { listPermissions, syncPermissions } from "../services/permissions.js";
import { prisma } from "../prisma.js";

export function registerRoleRoutes(app: express.Express) {
  // --- Roles ---

  app.get(
    "/api/roles",
    authenticate,
    authorize("read", "Role"),
    asyncHandler(async (req, res) => {
      const roles = await listRoles();
      res.json({ status: "ok", roles });
    })
  );

  app.post(
    "/api/roles",
    authenticate,
    authorize("create", "Role"),
    asyncHandler(async (req, res) => {
      const role = await createRole(req.body);
      res.json({ status: "ok", role });
    })
  );

  app.put(
    "/api/roles/:id",
    authenticate,
    authorize("update", "Role"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const role = await updateRole(id, req.body);
      res.json({ status: "ok", role });
    })
  );

  app.delete(
    "/api/roles/:id",
    authenticate,
    authorize("delete", "Role"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      await deleteRole(id);
      res.json({ status: "ok" });
    })
  );

  // --- Permissions ---

  app.get(
    "/api/permissions",
    authenticate,
    authorize("read", "Permission"),
    asyncHandler(async (req, res) => {
      const permissions = await listPermissions();
      res.json({ status: "ok", permissions });
    })
  );

  app.post(
    "/api/permissions/sync",
    authenticate,
    authorize("manage", "Permission"),
    asyncHandler(async (req, res) => {
      await syncPermissions();
      const permissions = await listPermissions();
      res.json({ status: "ok", permissions });
    })
  );

  // --- Role Assignments ---

  app.post(
    "/api/roles/:id/permissions",
    authenticate,
    authorize("update", "Role"),
    asyncHandler(async (req, res) => {
      const roleId = Number(req.params.id);
      const { permissionIds } = req.body; // Expect array of IDs
      await assignPermissionsToRole(roleId, permissionIds);

      // Invalidate cache for all users with this role is tricky without stored proc or complex query.
      // For now, simpler approach: bump ALL users' version or just accept eventual consistency (5 min cache).
      // Or: Find users with this role and bump their version.
      await prisma.userPermissionVersion.updateMany({
        where: {
          user: {
            roles: {
              some: { roleId },
            },
          },
        },
        data: { version: { increment: 1 } },
      });

      res.json({ status: "ok" });
    })
  );
}
