import { prisma } from "../server/prisma.ts";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Clean up existing data (optional, be careful in prod)
  // await prisma.user.deleteMany();
  // await prisma.person.deleteMany();

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
  const passwordHash = await bcrypt.hash("temp1234", salt); // Temporary password, though login will be passwordless

  const person = await prisma.person.create({
    data: {
      rut: "11.111.111-1", // Placeholder RUT, user should update this in onboarding
      names: "Lucas",
      fatherName: "Pulgar",
      email: email,
      user: {
        create: {
          email: email,
          passwordHash: passwordHash,
          role: "GOD",
          status: "PENDING_SETUP",
        },
      },
    },
  });

  console.log(`✅ Created user: ${email} with ID: ${person.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
