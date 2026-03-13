import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // hash passwords
  const userPassword = await bcrypt.hash("user", 10);
  const adminPassword = await bcrypt.hash("admin", 10);

  /**
   * USER ACCOUNT
   */
  await prisma.user.upsert({
    where: { username: "user" },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: "user@rolf.local",
      username: "user",
      password: userPassword,
      role: Role.USER,
    },
  });

  /**
   * ADMIN ACCOUNT
   */
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      id: crypto.randomUUID(),
      email: "admin@rolf.local",
      username: "admin",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });