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

      // Check if users exist in this role
      const users = await prisma.user.findMany({
        where: { roles: { some: { roleId: id } } },
      });

      if (users.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "No se puede eliminar el rol porque tiene usuarios asignados. Reasígnelos primero.",
        });
      }

      await deleteRole(id);
      res.json({ status: "ok" });
    })
  );

  // Get users for a specific role
  app.get(
    "/api/roles/:id/users",
    authenticate,
    authorize("read", "Role"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      // We can reuse the findUsersByRoleIds logic but just for one
      const users = await prisma.user.findMany({
        where: { roles: { some: { roleId: id } } },
        select: {
          id: true,
          email: true,
          person: { select: { names: true, fatherName: true } },
        },
      });
      res.json({ status: "ok", users });
    })
  );

  // Bulk Reassign Users
  app.post(
    "/api/roles/:id/reassign",
    authenticate,
    authorize("update", "Role"), // Or manage User
    asyncHandler(async (req, res) => {
      const oldRoleId = Number(req.params.id);
      const { targetRoleId } = req.body;

      if (!targetRoleId || isNaN(Number(targetRoleId))) {
        return res.status(400).json({ status: "error", message: "Rol de destino inválido" });
      }

      // Logic: Find all users with oldRoleId, replace link with targetRoleId
      // Prisma doesn't support updateMany on many-to-many implicit/explicit easily if it's strictly normalizing,
      // but assuming UserRole (User <-> Role) table:

      // 1. Update UserRole entries where roleId = oldRoleId to targetRoleId
      // Check if target role exists first
      const targetRole = await prisma.role.findUnique({ where: { id: Number(targetRoleId) } });
      if (!targetRole) return res.status(404).json({ status: "error", message: "Rol de destino no encontrado" });

      // Check if trying to reassign to same role
      if (oldRoleId === Number(targetRoleId)) {
        return res.status(400).json({ status: "error", message: "No puedes reasignar al mismo rol" });
      }

      await prisma.userRoleAssignment.updateMany({
        where: { roleId: oldRoleId },
        data: { roleId: Number(targetRoleId) },
      });

      res.json({ status: "ok", message: "Usuarios reasignados correctamente" });
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

  app.get(
    "/api/roles/:id/permissions",
    authenticate,
    authorize("read", "Role"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const role = await prisma.role.findUnique({
        where: { id },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) return res.status(404).json({ status: "error", message: "Role not found" });

      const permissions = role.permissions.map((rp) => rp.permission);
      res.json({ status: "ok", permissions });
    })
  );

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
