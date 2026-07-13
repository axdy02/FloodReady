import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import type { AuthRole } from '../../shared/security/index.js';

import type { AuthenticatedUserRecord, LoginUserRecord, RefreshSessionRecord } from './auth.types.js';

export type Transaction = Prisma.TransactionClient;

interface RefreshSessionCreateInput {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string | null;
}

interface AuditCreateInput {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Prisma.InputJsonValue;
  ipAddress: string;
}

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const loginUserSelect = {
  ...authUserSelect,
  passwordHash: true,
  failedLoginAttempts: true,
  failedLoginWindowStartedAt: true,
  lockedUntil: true
} satisfies Prisma.UserSelect;

const toAuthenticatedRecord = (user: {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AuthenticatedUserRecord => user;

const toLoginRecord = (user: {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  passwordHash: string;
  failedLoginAttempts: number;
  failedLoginWindowStartedAt: Date | null;
  lockedUntil: Date | null;
}): LoginUserRecord => user;

export const findUserForLogin = async (email: string): Promise<LoginUserRecord | null> => {
  const user = await prisma.user.findUnique({ where: { email }, select: loginUserSelect });

  return user === null ? null : toLoginRecord(user);
};

export const findAuthenticatedUser = async (id: string): Promise<AuthenticatedUserRecord | null> => {
  const user = await prisma.user.findUnique({ where: { id }, select: authUserSelect });

  return user === null ? null : toAuthenticatedRecord(user);
};

export const createUser = async (
  transaction: Transaction,
  input: { name: string; email: string; passwordHash: string }
): Promise<AuthenticatedUserRecord> => {
  const user = await transaction.user.create({
    data: { ...input, role: 'USER', isActive: true },
    select: authUserSelect
  });

  return toAuthenticatedRecord(user);
};

export const createAudit = async (transaction: Transaction, input: AuditCreateInput): Promise<void> => {
  await transaction.auditLog.create({ data: input });
};

export const lockUserForLogin = async (transaction: Transaction, id: string): Promise<LoginUserRecord | null> => {
  const rows = await transaction.$queryRaw<LoginUserRecord[]>(Prisma.sql`
    SELECT
      "id",
      "name",
      "email",
      "role",
      "is_active" AS "isActive",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt",
      "password_hash" AS "passwordHash",
      "failed_login_attempts" AS "failedLoginAttempts",
      "failed_login_window_started_at" AS "failedLoginWindowStartedAt",
      "locked_until" AS "lockedUntil"
    FROM "users"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `);

  return rows[0] ?? null;
};

export const updateLoginFailureState = async (
  transaction: Transaction,
  id: string,
  data: { failedLoginAttempts: number; failedLoginWindowStartedAt: Date; lockedUntil: Date | null }
): Promise<void> => {
  await transaction.user.update({ where: { id }, data });
};

export const resetLoginStateAndCreateSession = async (
  transaction: Transaction,
  userId: string,
  replacementPasswordHash: string | null,
  session: RefreshSessionCreateInput
): Promise<void> => {
  await transaction.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      failedLoginWindowStartedAt: null,
      lockedUntil: null,
      ...(replacementPasswordHash === null ? {} : { passwordHash: replacementPasswordHash })
    }
  });
  await transaction.refreshSession.create({ data: session });
};

export const lockRefreshSession = async (transaction: Transaction, id: string): Promise<RefreshSessionRecord | null> => {
  const rows = await transaction.$queryRaw<RefreshSessionRecord[]>(Prisma.sql`
    SELECT
      "id",
      "user_id" AS "userId",
      "token_hash" AS "tokenHash",
      "family_id" AS "familyId",
      "expires_at" AS "expiresAt",
      "revoked_at" AS "revokedAt",
      "replaced_by_id" AS "replacedById"
    FROM "refresh_sessions"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `);

  return rows[0] ?? null;
};

export const findUserInTransaction = async (transaction: Transaction, id: string): Promise<AuthenticatedUserRecord | null> => {
  const user = await transaction.user.findUnique({ where: { id }, select: authUserSelect });

  return user === null ? null : toAuthenticatedRecord(user);
};

export const revokeActiveFamilySessions = async (transaction: Transaction, familyId: string, revokedAt: Date): Promise<number> => {
  const result = await transaction.refreshSession.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt }
  });

  return result.count;
};

export const replaceRefreshSession = async (
  transaction: Transaction,
  parentId: string,
  successor: RefreshSessionCreateInput,
  revokedAt: Date
): Promise<void> => {
  await transaction.refreshSession.create({ data: successor });
  await transaction.refreshSession.update({
    where: { id: parentId },
    data: { revokedAt, replacedById: successor.id }
  });
};
