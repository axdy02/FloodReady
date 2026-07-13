import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../../src/database/prisma.js";

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: "USER" | "MODERATOR" | "ADMIN";
}

const password = "CorrectHorseBatteryStaple";

export const clearDatabase = async (): Promise<void> => {
  await prisma.auditLog.deleteMany();
  await prisma.floodReport.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.user.deleteMany();
};

export const createTestUser = async (role: TestUser["role"] = "USER", active = true): Promise<TestUser> => {
  const id = randomUUID();
  const email = `user-${id}@example.test`;
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32
  });
  await prisma.user.create({
    data: {
      id,
      name: "Test User",
      email,
      passwordHash,
      role,
      isActive: active
    }
  });
  return { id, email, password, role };
};

export const firstCookie = (values: string[] | undefined): string => {
  const value = values?.[0];
  if (value === undefined) {
    throw new Error("Expected refresh cookie");
  }
  const separator = value.indexOf(";");
  return separator === -1 ? value : value.slice(0, separator);
};
