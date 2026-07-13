import argon2 from "argon2";
import { config } from "../src/config/index.js";
import { prisma } from "../src/database/prisma.js";

const main = async (): Promise<void> => {
  if (config.SEED_ADMIN_NAME === undefined || config.SEED_ADMIN_EMAIL === undefined || config.SEED_ADMIN_PASSWORD === undefined) {
    return;
  }
  const email = config.SEED_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing !== null) {
    return;
  }
  const passwordHash = await argon2.hash(config.SEED_ADMIN_PASSWORD, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 });
  await prisma.user.create({ data: { name: config.SEED_ADMIN_NAME.normalize("NFKC").trim(), email, passwordHash, role: "ADMIN" } });
};

main().then(() => prisma.$disconnect()).catch(async () => {
  await prisma.$disconnect();
  process.exitCode = 1;
});
