import jwt from "jsonwebtoken";

import { JWT_SECRET as CONFIG_SECRET } from "../server/config.js";
import { hashPassword } from "../server/lib/crypto.js";
import { prisma } from "../server/prisma.js";
export const JWT_SECRET = CONFIG_SECRET;

export function generateToken(user: { id: number; email: string; role: string }) {
  return jwt.sign({ sub: String(user.id), email: user.email, roles: [user.role] }, JWT_SECRET, { expiresIn: "1h" });
}

export async function createTestUser(
  overrides: { role?: "GOD" | "ADMIN" | "ANALYST" | "VIEWER"; email?: string } = {}
) {
  const email = overrides.email || `test-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`;
  const passwordHash = await hashPassword("password123");

  // Ensure role exists (idempotent)
  const roleName = overrides.role || "VIEWER";
  let role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    try {
      role = await prisma.role.create({ data: { name: roleName } });
    } catch {
      // Race condition: another test created it
      role = await prisma.role.findUnique({ where: { name: roleName } });
    }
  }
  if (!role) throw new Error(`Failed to ensure role ${roleName}`);

  // Assign default permissions
  if (roleName === "ADMIN" || roleName === "GOD") {
    // Admin gets manage all
    const perm = await prisma.permission.upsert({
      where: { action_subject: { action: "manage", subject: "all" } },
      update: {},
      create: { action: "manage", subject: "all" },
    });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      update: {},
      create: { roleId: role.id, permissionId: perm.id },
    });
  } else {
    // Viewer gets read access to basic entities
    const entities = ["Transaction", "Account", "Category", "Contact", "Budget"];
    for (const entity of entities) {
      const perm = await prisma.permission.upsert({
        where: { action_subject: { action: "read", subject: entity } },
        update: {},
        create: { action: "read", subject: entity },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    }
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    // Ensure user has the role
    const hasRole = await prisma.userRoleAssignment.findUnique({
      where: { userId_roleId: { userId: existingUser.id, roleId: role.id } },
    });

    if (!hasRole) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: existingUser.id,
          roleId: role.id,
        },
      });
    }

    // Return existing user with enriched role
    return { ...existingUser, role: roleName };
  }

  // Create person first (idempotent)
  let person = await prisma.person.findFirst({ where: { email } });
  if (!person) {
    try {
      person = await prisma.person.create({
        data: {
          names: "Test User",
          rut: `11111111-${Date.now().toString().slice(-4)}`,
          email,
        },
      });
    } catch {
      person = await prisma.person.findFirst({ where: { email } });
    }
  }
  if (!person) throw new Error("Failed to create person");

  // Create user
  let user;
  try {
    user = await prisma.user.create({
      data: {
        personId: person.id,
        email,
        passwordHash,
        status: "ACTIVE",
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
    });
  } catch {
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (!user) throw new Error("Failed to create user");

  return { ...user, role: roleName };
}
