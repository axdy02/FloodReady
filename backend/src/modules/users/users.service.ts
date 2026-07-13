import { AppError } from '../../shared/errors/index.js';
import { encodeCursor, hashFilters, validateCursor, CursorValidationError } from '../../shared/validation/cursor.js';

import {
  acquireAdminChangeLock,
  countActiveAdmins,
  createAudit,
  findUser,
  listUsers,
  lockUser,
  revokeUserSessions,
  updateName,
  updateUser
} from './users.repository.js';
import { prisma } from '../../database/prisma.js';
import { toUserDto, type UpdateProfileInput, type UpdateUserInput, type UserCollection, type UserListQuery, type UserDto } from './users.types.js';

const notFound = (): AppError => new AppError(404, 'NOT_FOUND', 'Resource not found');

const validationError = (): AppError => new AppError(400, 'VALIDATION_ERROR', 'Invalid request', [{ path: 'query.cursor', message: 'Invalid value' }]);

export const getMe = async (userId: string): Promise<UserDto> => {
  const user = await findUser(userId);

  if (user === null || !user.isActive) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }

  return toUserDto(user);
};

export const updateMe = async (userId: string, input: UpdateProfileInput, ipAddress: string): Promise<UserDto> =>
  prisma.$transaction(async (transaction) => {
    const user = await lockUser(transaction, userId);

    if (user === null || !user.isActive) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    if (user.name === input.name) {
      return toUserDto(user);
    }

    const updated = await updateName(transaction, user.id, input.name);
    await createAudit(transaction, {
      actorId: user.id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'USER',
      entityId: user.id,
      metadata: { changedFields: ['name'] },
      ipAddress
    });

    return toUserDto(updated);
  });

export const getUser = async (userId: string): Promise<UserDto> => {
  const user = await findUser(userId);

  if (user === null) {
    throw notFound();
  }

  return toUserDto(user);
};

export const getUsers = async (query: UserListQuery): Promise<UserCollection> => {
  const filters = { isActive: query.isActive, role: query.role };
  let cursor = null;

  if (query.cursor !== null) {
    try {
      cursor = validateCursor(query.cursor, 'users', query.sort, filters);
    } catch (error) {
      if (error instanceof CursorValidationError) {
        throw validationError();
      }

      throw error;
    }
  }

  const rows = await listUsers(query, cursor);
  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last !== undefined
    ? encodeCursor({
        v: 1,
        resource: 'users',
        sort: query.sort,
        timestamp: last.createdAt.toISOString(),
        id: last.id,
        filterHash: hashFilters(filters)
      })
    : null;

  return {
    items: pageRows.map(toUserDto),
    pagination: { limit: query.limit, hasMore, nextCursor }
  };
};

export const updateManagedUser = async (
  actorId: string,
  targetId: string,
  input: UpdateUserInput,
  ipAddress: string
): Promise<UserDto> =>
  prisma.$transaction(async (transaction) => {
    await acquireAdminChangeLock(transaction);
    const target = await lockUser(transaction, targetId);

    if (target === null) {
      throw notFound();
    }

    const newRole = input.role ?? target.role;
    const newIsActive = input.isActive ?? target.isActive;
    const changes = newRole !== target.role || newIsActive !== target.isActive;

    if (!changes) {
      return toUserDto(target);
    }

    if (actorId === target.id) {
      throw new AppError(409, 'ADMIN_SAFEGUARD', 'Administrator change not allowed');
    }

    const removesActiveAdmin = target.role === 'ADMIN' && target.isActive && (newRole !== 'ADMIN' || !newIsActive);

    if (removesActiveAdmin && (await countActiveAdmins(transaction)) <= 1) {
      throw new AppError(409, 'ADMIN_SAFEGUARD', 'Administrator change not allowed');
    }

    const updated = await updateUser(transaction, target.id, { role: newRole, isActive: newIsActive });
    await revokeUserSessions(transaction, target.id, new Date());
    await createAudit(transaction, {
      actorId,
      action: 'ADMIN_USER_UPDATED',
      entityType: 'USER',
      entityId: target.id,
      metadata: {
        previousRole: target.role,
        newRole,
        previousIsActive: target.isActive,
        newIsActive
      },
      ipAddress
    });

    return toUserDto(updated);
  });
