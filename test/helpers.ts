import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { prisma } from "../server/prisma.js";

export const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

export function generateToken(user: { id: number; email: string; role: string }) {
  return jwt.sign({ sub: String(user.id), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "1h" });
}

export async function createTestUser(
  overrides: { role?: "GOD" | "ADMIN" | "ANALYST" | "VIEWER"; email?: string } = {}
) {
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const passwordHash = await bcrypt.hash("password123", 10);

  // Create person first
  const person = await prisma.person.create({
    data: {
      names: "Test User",
      rut: `11111111-${Date.now().toString().slice(-4)}`,
      email,
    },
  });

  // Create user
  const user = await prisma.user.create({
    data: {
      personId: person.id,
      email,
      passwordHash,
      role: overrides.role || "VIEWER",
      status: "ACTIVE",
    },
  });

  return user;
}
