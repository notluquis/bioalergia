import { prisma } from "../prisma.js";

export async function findUserByEmail(email: string) {
  return await prisma.user.findUnique({
    where: { email },
    include: {
      person: {
        select: {
          names: true,
          fatherName: true,
        },
      },
    },
  });
}

export async function findUserById(id: number) {
  return await prisma.user.findUnique({
    where: { id },
    include: {
      person: {
        select: {
          names: true,
          fatherName: true,
        },
      },
    },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveUserRole(user: any) {
  return user.role;
}
