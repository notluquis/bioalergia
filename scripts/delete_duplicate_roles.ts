import { prisma } from "../server/prisma.ts";

async function main() {
  console.log("🗑️ Deleting duplicate roles...");

  const rolesToDelete = ["CoordinadorFinanciero", "EnfermeroUniversitario"];

  for (const name of rolesToDelete) {
    const role = await prisma.role.findUnique({
      where: { name },
      include: { _count: { select: { users: true } } },
    });

    if (role) {
      if (role._count.users > 0) {
        console.warn(`⚠️ Role ${name} has ${role._count.users} users! Skipping deletion to be safe.`);
      } else {
        console.log(`Deleting empty role: ${name}...`);
        await prisma.role.delete({ where: { name } });
      }
    } else {
      console.log(`Role ${name} not found.`);
    }
  }

  console.log("✅ Duplicates deleted.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
