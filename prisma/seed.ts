import { prisma } from "../server/prisma.ts";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Clean up existing data (optional, be careful in prod)
  // await prisma.user.deleteMany();
  // await prisma.person.deleteMany();

  // 1. Seed Permissions and Roles
  console.log("Seeding Roles and Permissions...");

  // We need to recreate the permission map logic briefly here or strict hardcode
  // to avoid complex imports if possible, but let's try to map the INITIAL_ROLES
  // Assuming keys are "action.subject"

  // Hardcode roles/permissions here to avoid complex import issues with ts-node
  const ROLES = [
    {
      name: "SystemAdministrator",
      permissions: [{ action: "manage", subject: "all" }],
    },
    {
      name: "OperationsManager",
      permissions: [
        { action: "create", subject: "Transaction" },
        { action: "read", subject: "Transaction" },
        { action: "manage", subject: "User" },
        { action: "manage", subject: "Role" },
        { action: "manage", subject: "Setting" },
        // Add minimal set for admin
      ],
    },
    {
      name: "VIEWER",
      permissions: [{ action: "read", subject: "CalendarEvent" }],
    },
  ];

  for (const roleDef of ROLES) {
    // Upsert Role
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: {},
      create: { name: roleDef.name, description: "Seeded Role" },
    });

    // Sync Permissions
    for (const perm of roleDef.permissions) {
      const p = await prisma.permission.upsert({
        where: { action_subject: { action: perm.action, subject: perm.subject } },
        update: {},
        create: { action: perm.action, subject: perm.subject },
      });

      // Upsert RolePermission
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }
  }

  // 2. Create Super Admin Person
  const email = "lpulgar@bioalergia.cl";

  // Check if exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log(`User ${email} already exists. Skipping.`);
    return;
  }

  console.log(`Creating Person and User for ${email}...`);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash("temp1234", salt);

  // Fetch SystemAdministrator role
  const adminRole = await prisma.role.findUnique({ where: { name: "SystemAdministrator" } });
  if (!adminRole) throw new Error("SystemAdministrator role not found after seeding");

  const person = await prisma.person.create({
    data: {
      rut: "11.111.111-1",
      names: "Lucas",
      fatherName: "Pulgar",
      email: email,
      user: {
        create: {
          email: email,
          passwordHash: passwordHash,
          status: "PENDING_SETUP",
          roles: {
            create: {
              role: { connect: { id: adminRole.id } },
            },
          },
        },
      },
    },
  });

  console.log(`✅ Created user: ${email} with ID: ${person.id} and Role: SystemAdministrator`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
