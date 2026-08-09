/* eslint-disable no-console */
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email =
    process.env.SEED_ADMIN_EMAIL || "bachansingh1604@gmail.com";

  const password =
    process.env.SEED_ADMIN_PASSWORD || "Campus@123!";

  const name =
    process.env.SEED_ADMIN_NAME || "Bachan Singh";

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  const existing = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existing) {
    console.log("==================================");
    console.log("Admin already exists");
    console.log(`Email : ${existing.email}`);
    console.log("Seed skipped.");
    console.log("==================================");
    return;
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log("==================================");
  console.log("Admin user created successfully");
  console.log(`ID       : ${admin.id}`);
  console.log(`Email    : ${email}`);
  console.log(`Password : ${password}`);
  console.log("==================================");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });