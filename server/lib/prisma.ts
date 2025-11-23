import { PrismaClient } from "../../generated/prisma/client.js";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
});

export async function disconnectPrisma() {
  await prisma.$disconnect().catch(() => {
    /* noop */
  });
}
