import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import type { CursorPayload } from '../../shared/types/pagination.js';

import type { UpdateUserInput, UserListQuery, UserRecord } from './users.types.js';

export type Transaction = Prisma.TransactionClient;

interface AuditCreateInput {
  actorId: string;
  action: 'USER_PROFILE_UPDATED' | 'ADMIN_USER_UPDATED';
  entityType: 'USER';
  entityId: string;
  metadata: Prisma.InputJsonValue;
  ipAddress: string;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const toRecord = (user: {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord => user;

export const findUser = async (id: string): Promise<UserRecord | null> => {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });

  return user === null ? null : toRecord(user);
};

export const lockUser = async (transaction: Transaction, id: string): Promise<UserRecord | null> => {
  const rows = await transaction.$queryRaw<UserRecord[]>(Prisma.sql`
    SELECT
      "id",
      "name",
      "email",
      "role",
      "is_active" AS "isActive",
      "created_at" AS "createdAt",
      "updated_at" AS "updatedAt"
    FROM "users"
    WHERE "id" = ${id}::uuid
    FOR UPDATE
  `);

  return rows[0] ?? null;
};

export const updateName = async (transaction: Transaction, id: string, name: string): Promise<UserRecord> => {
  const user = await transaction.user.update({ where: { id }, data: { name }, select: userSelect });

  return toRecord(user);
};

export const updateUser = async (transaction: Transaction, id: string, input: UpdateUserInput): Promise<UserRecord> => {
  const user = await transaction.user.update({ where: { id }, data: input, select: userSelect });

  return toRecord(user);
};

export const createAudit = async (transaction: Transaction, input: AuditCreateInput): Promise<void> => {
  await transaction.auditLog.create({ data: input });
};

export const acquireAdminChangeLock = async (transaction: Transaction): Promise<void> => {
  await transaction.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${84_666_301})`);
};

export const countActiveAdmins = async (transaction: Transaction): Promise<number> =>
  transaction.user.count({ where: { role: 'ADMIN', isActive: true } });

export const revokeUserSessions = async (transaction: Transaction, userId: string, revokedAt: Date): Promise<void> => {
  await transaction.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt } });
};

export const listUsers = async (query: UserListQuery, cursor: CursorPayload | null): Promise<UserRecord[]> => {
  const conditions: Prisma.Sql[] = [];

  if (query.role !== null) {
    conditions.push(Prisma.sql`u.role = ${query.role}::"Role"`);
  }

  if (query.isActive !== null) {
    conditions.push(Prisma.sql`u.is_active = ${query.isActive}`);
  }

  if (cursor !== null) {
    const timestamp = new Date(cursor.timestamp);
    conditions.push(query.sort === 'asc'
      ? Prisma.sql`(u.created_at, u.id) > (${timestamp}::timestamptz(3), ${cursor.id}::uuid)`
      : Prisma.sql`(u.created_at, u.id) < (${timestamp}::timestamptz(3), ${cursor.id}::uuid)`);
  }

  const where = conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, " AND ");
  const order = query.sort === 'asc'
    ? Prisma.sql`u.created_at ASC, u.id ASC`
    : Prisma.sql`u.created_at DESC, u.id DESC`;
  const users = await prisma.$queryRaw<UserRecord[]>`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.is_active AS "isActive",
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt"
    FROM "users" u
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${query.limit + 1}
  `;

  return users;
};
