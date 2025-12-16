import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SYSTEM_ROLES = ["ADMIN", "GOD", "SystemAdministrator", "OperationsManager"];

async function main() {
  console.log("Setting system roles...");

  try {
    const result = await prisma.role.updateMany({
      where: {
        name: {
          in: SYSTEM_ROLES,
        },
      },
      data: {
        isSystem: true,
      },
    });

    console.log(`Updated ${result.count} roles to be system roles.`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
