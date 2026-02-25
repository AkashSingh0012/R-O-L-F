import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 10);

  // Create Admin
  const user_admin = await prisma.user.upsert({
    where: { email: "admin@rolf.local" },
    update: {},
    create: {
      email: "admin@rolf.local",
      username: "user_admin",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Create Normal User
  const user_user = await prisma.user.upsert({
    where: { email: "user@rolf.local" },
    update: {},
    create: {
      email: "user@rolf.local",
      username: "user_user",
      password: hashedPassword,
      role: "USER",
    },
  });

  console.log(" Seed complete.");
  console.log({ user_admin, user_user });
}

main()
  .catch((e) => {
    console.error(" Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });