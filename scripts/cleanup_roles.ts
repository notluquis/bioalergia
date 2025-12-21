import { prisma } from "../server/prisma.ts";

async function main() {
  console.log("🧹 Cleaning up role descriptions...");

  // Update specific legacy roles to have generic descriptions
  // or just clear the description if we want them "dynamic" and user-managed.
  // User said "don't use hardcoded descriptions... use directly the roles".
  // So I'll just clear the "bad" descriptions.

  const targetRoles = [
    "Socia",
    "Socio",
    "EnfermeroUniversitario",
    "Tens",
    "CoordinadorFinanciero",
    "Enfermero Universitario",
    "Coordinador Financiero",
  ];

  for (const roleName of targetRoles) {
    // Check if role exists
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (role) {
      console.log(`Updating description for ${roleName}...`);
      await prisma.role.update({
        where: { name: roleName },
        data: { description: `${roleName}` }, // Or empty string? Using Name as description is neutral.
      });
    }
  }

  // Ensure SystemAdministrator is correct
  await prisma.role
    .update({
      where: { name: "SystemAdministrator" },
      data: { description: "Administrador del sistema con acceso total" },
    })
    .catch(() => console.log("SystemAdministrator role not found or update failed"));

  console.log("✅ Roles cleaned up.");
}

main()
  .catch(console.warn)
  .finally(() => prisma.$disconnect());
