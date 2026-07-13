import { randomUUID } from 'node:crypto';

import { Prisma } from '../../generated/prisma/client.js';
import { config } from '../../config/index.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../shared/errors/index.js';
import {
  createAccessToken,
  createRefreshToken,
  hashPassword,
  hashRefreshToken,
  normalizeUserAgent,
  passwordNeedsRehash,
  TokenValidationError,
  verifyPasswordOrDummy,
  verifyRefreshToken
} from '../../shared/security/index.js';

import {
  createAudit,
  createUser,
  findAuthenticatedUser,
  findUserForLogin,
  findUserInTransaction,
  lockRefreshSession,
  lockUserForLogin,
  replaceRefreshSession,
  resetLoginStateAndCreateSession,
  revokeActiveFamilySessions,
  updateLoginFailureState
} from './auth.repository.js';
import type { Transaction } from './auth.repository.js';
import {
  toUserDto,
  type AuthDto,
  type AuthenticatedUserRecord,
  type LoginInput,
  type LoginUserRecord,
  type RegisterInput,
  type UserDto
} from './auth.types.js';

interface RequestContext {
  ipAddress: string;
  userAgent: string | undefined;
}

interface LoginResult {
  auth: AuthDto;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type RefreshResult =
  | { kind: 'invalid' }
  | { kind: 'success'; auth: AuthDto; refreshToken: string; refreshExpiresAt: Date };

const invalidCredentials = (): AppError => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

const isLocked = (user: LoginUserRecord, now: Date): boolean => user.lockedUntil !== null && user.lockedUntil > now;

const isDuplicateEmail = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const buildAuthDto = (user: AuthenticatedUserRecord): AuthDto => {
  const access = createAccessToken(user.id, user.role);

  return {
    accessToken: access.token,
    tokenType: 'Bearer',
    expiresInSeconds: access.expiresInSeconds,
    user: toUserDto(user)
  };
};

const recordFailedLogin = async (userId: string, now: Date): Promise<void> => {
  await prisma.$transaction(async (transaction) => {
    const user = await lockUserForLogin(transaction, userId);

    if (user === null || !user.isActive || isLocked(user, now)) {
      return;
    }

    const startsFreshWindow =
      user.lockedUntil !== null ||
      user.failedLoginWindowStartedAt === null ||
      now.getTime() - user.failedLoginWindowStartedAt.getTime() >= config.LOGIN_FAILURE_WINDOW_MS;
    const failedLoginAttempts = startsFreshWindow ? 1 : user.failedLoginAttempts + 1;
    const lockedUntil = failedLoginAttempts >= config.LOGIN_FAILURE_MAX ? new Date(now.getTime() + config.LOGIN_LOCK_MS) : null;

    await updateLoginFailureState(transaction, user.id, {
      failedLoginAttempts,
      failedLoginWindowStartedAt: startsFreshWindow ? now : user.failedLoginWindowStartedAt ?? now,
      lockedUntil
    });
  });
};

export const register = async (input: RegisterInput, context: RequestContext): Promise<UserDto> => {
  const passwordHash = await hashPassword(input.password);

  try {
    return await prisma.$transaction(async (transaction) => {
      const user = await createUser(transaction, {
        name: input.name,
        email: input.email,
        passwordHash
      });
      await createAudit(transaction, {
        actorId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'USER',
        entityId: user.id,
        metadata: { role: 'USER' },
        ipAddress: context.ipAddress
      });

      return toUserDto(user);
    });
  } catch (error) {
    if (isDuplicateEmail(error)) {
      throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Email already registered');
    }

    throw error;
  }
};

export const login = async (input: LoginInput, context: RequestContext): Promise<LoginResult> => {
  const initialUser = await findUserForLogin(input.email);
  const passwordMatches = await verifyPasswordOrDummy(initialUser?.passwordHash ?? null, input.password);
  const replacementPasswordHash =
    passwordMatches && initialUser !== null && passwordNeedsRehash(initialUser.passwordHash) ? await hashPassword(input.password) : null;
  const now = new Date();

  if (!passwordMatches) {
    if (initialUser !== null) {
      await recordFailedLogin(initialUser.id, now);
    }

    throw invalidCredentials();
  }

  const result = await prisma.$transaction(async (transaction) => {
    if (initialUser === null) {
      return null;
    }

    const user = await lockUserForLogin(transaction, initialUser.id);

    if (
      user === null ||
      user.passwordHash !== initialUser.passwordHash ||
      !user.isActive ||
      isLocked(user, now)
    ) {
      return null;
    }

    const familyId = randomUUID();
    const sessionId = randomUUID();
    const refreshExpiresAt = new Date(now.getTime() + config.refreshTokenTtlMs);
    const refreshToken = createRefreshToken(user.id, familyId, sessionId, refreshExpiresAt);
    const auth = buildAuthDto(user);

    await resetLoginStateAndCreateSession(transaction, user.id, replacementPasswordHash, {
      id: sessionId,
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
      ipAddress: context.ipAddress,
      userAgent: normalizeUserAgent(context.userAgent)
    });

    return { auth, refreshToken, refreshExpiresAt };
  });

  if (result === null) {
    throw invalidCredentials();
  }

  return result;
};

export const refresh = async (rawToken: string, context: RequestContext): Promise<RefreshResult> => {
  let claims: ReturnType<typeof verifyRefreshToken>;

  try {
    claims = verifyRefreshToken(rawToken);
  } catch (error) {
    if (error instanceof TokenValidationError) {
      return { kind: 'invalid' };
    }

    throw error;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const session = await lockRefreshSession(transaction, claims.jti);

    if (
      session === null ||
      session.userId !== claims.userId ||
      session.familyId !== claims.familyId ||
      session.id !== claims.jti ||
      session.tokenHash !== tokenHash ||
      session.expiresAt <= now
    ) {
      return { kind: 'invalid' };
    }

    const user = await findUserInTransaction(transaction, session.userId);

    if (user === null || !user.isActive) {
      await revokeActiveFamilySessions(transaction, session.familyId, now);
      return { kind: 'invalid' };
    }

    if (session.revokedAt !== null || session.replacedById !== null) {
      const revokedSessionCount = await revokeActiveFamilySessions(transaction, session.familyId, now);
      await createAudit(transaction, {
        actorId: user.id,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        entityType: 'REFRESH_SESSION',
        entityId: session.id,
        metadata: { familyId: session.familyId, revokedSessionCount },
        ipAddress: context.ipAddress
      });
      return { kind: 'invalid' };
    }

    const successorId = randomUUID();
    const refreshToken = createRefreshToken(user.id, session.familyId, successorId, session.expiresAt);
    const auth = buildAuthDto(user);

    await replaceRefreshSession(
      transaction,
      session.id,
      {
        id: successorId,
        userId: user.id,
        tokenHash: hashRefreshToken(refreshToken),
        familyId: session.familyId,
        expiresAt: session.expiresAt,
        ipAddress: context.ipAddress,
        userAgent: normalizeUserAgent(context.userAgent)
      },
      now
    );

    return { kind: 'success', auth, refreshToken, refreshExpiresAt: session.expiresAt };
  });
};

export const logout = async (rawToken: string | undefined, context: Pick<RequestContext, 'ipAddress'>): Promise<void> => {
  if (rawToken === undefined) {
    return;
  }

  let claims: ReturnType<typeof verifyRefreshToken>;

  try {
    claims = verifyRefreshToken(rawToken);
  } catch (error) {
    if (error instanceof TokenValidationError) {
      return;
    }

    throw error;
  }

  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  await prisma.$transaction(async (transaction: Transaction) => {
    const session = await lockRefreshSession(transaction, claims.jti);

    if (
      session === null ||
      session.userId !== claims.userId ||
      session.familyId !== claims.familyId ||
      session.tokenHash !== tokenHash ||
      session.expiresAt <= now ||
      session.revokedAt !== null ||
      session.replacedById !== null
    ) {
      return;
    }

    const revokedSessionCount = await revokeActiveFamilySessions(transaction, session.familyId, now);

    if (revokedSessionCount > 0) {
      await createAudit(transaction, {
        actorId: session.userId,
        action: 'AUTH_LOGOUT',
        entityType: 'REFRESH_SESSION',
        entityId: session.id,
        metadata: { familyId: session.familyId },
        ipAddress: context.ipAddress
      });
    }
  });
};

export const getCurrentUser = async (userId: string): Promise<UserDto> => {
  const user = await findAuthenticatedUser(userId);

  if (user === null || !user.isActive) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }

  return toUserDto(user);
};
