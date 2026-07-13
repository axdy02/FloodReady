import { randomBytes } from 'node:crypto';

import argon2 from 'argon2';

const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32
} as const;

const dummyPassword = randomBytes(32).toString('base64url');
const dummyHash = await argon2.hash(dummyPassword, argonOptions);

export const hashPassword = async (password: string): Promise<string> => argon2.hash(password, argonOptions);

export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> =>
  argon2.verify(passwordHash, password);

export const verifyPasswordOrDummy = async (passwordHash: string | null, password: string): Promise<boolean> =>
  argon2.verify(passwordHash ?? dummyHash, password);

export const passwordNeedsRehash = (passwordHash: string): boolean => argon2.needsRehash(passwordHash, argonOptions);
