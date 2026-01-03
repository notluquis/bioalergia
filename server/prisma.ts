import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const basePrisma = new PrismaClient({ adapter });

// Extend Prisma with auto-bump for permission-related changes
export const prisma = basePrisma.$extends({
  query: {
    rolePermission: {
      async $allOperations({ operation, args, query }) {
        const result = await query(args);
        if (["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
          await basePrisma.userPermissionVersion
            .updateMany({
              data: { version: { increment: 1 } },
            })
            .catch(() => {});
          console.log(`[Prisma] Permission cache invalidated after RolePermission.${operation}`);
        }
        return result;
      },
    },
    userRoleAssignment: {
      async $allOperations({ operation, args, query }) {
        const result = await query(args);
        if (["create", "createMany", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
          await basePrisma.userPermissionVersion
            .updateMany({
              data: { version: { increment: 1 } },
            })
            .catch(() => {});
          console.log(`[Prisma] Permission cache invalidated after UserRoleAssignment.${operation}`);
        }
        return result;
      },
    },
  },
});

export { Prisma };

export async function disconnectPrisma() {
  await basePrisma.$disconnect().catch(() => {
    /* noop */
  });
}
