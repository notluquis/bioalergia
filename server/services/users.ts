import { prisma } from "../prisma.js";

export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
  });
}

export async function findUserById(id: number) {
  return await prisma.user.findUnique({
    where: { id },
  });
}

export async function updateUserMfa(userId: number, secret: string | null, enabled: boolean) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: secret,
      mfaEnabled: enabled,
    },
  });
}
