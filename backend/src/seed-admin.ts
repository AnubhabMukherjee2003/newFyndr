import { prisma } from "./lib/prisma";
import bcrypt from "bcrypt";

async function main() {
  const email = "admin@test.com";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin user already exists.");
    return;
  }

  const passwordHash = await bcrypt.hash("adminpassword", 12);
  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Admin user created successfully:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
