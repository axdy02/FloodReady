import { createHash, randomUUID } from 'node:crypto';

import type { CookieOptions } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import { config } from '../../config/index.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type AuthRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface AccessTokenClaims {
  userId: string;
  jti: string;
  role: AuthRole;
}

export interface RefreshTokenClaims {
  userId: string;
  jti: string;
  familyId: string;
}

export class TokenValidationError extends Error {
  public constructor() {
    super('Invalid token');
    this.name = 'TokenValidationError';
  }
}

const accessSecret = Buffer.from(config.ACCESS_TOKEN_SECRET, 'base64url');
const refreshSecret = Buffer.from(config.REFRESH_TOKEN_SECRET, 'base64url');

const isRole = (value: unknown): value is AuthRole => value === 'USER' || value === 'MODERATOR' || value === 'ADMIN';

const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);

const verifiedPayload = (token: string, secret: Buffer): JwtPayload => {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS512'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      clockTolerance: 30
    });

    if (
      typeof decoded === 'string' ||
      typeof decoded.iat !== 'number' ||
      !Number.isInteger(decoded.iat) ||
      typeof decoded.exp !== 'number' ||
      !Number.isInteger(decoded.exp)
    ) {
      throw new TokenValidationError();
    }

    return decoded;
  } catch {
    throw new TokenValidationError();
  }
};

export const createAccessToken = (userId: string, role: AuthRole, jti = randomUUID()): { token: string; expiresInSeconds: number } => {
  const expiresInSeconds = Math.floor(config.accessTokenTtlMs / 1_000);
  const token = jwt.sign(
    { tokenType: 'access', role },
    accessSecret,
    {
      algorithm: 'HS512',
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      subject: userId,
      jwtid: jti,
      expiresIn: expiresInSeconds
    }
  );

  return { token, expiresInSeconds };
};

export const createRefreshToken = (userId: string, familyId: string, jti: string, expiresAt: Date): string => {
  const issuedAtSeconds = Math.floor(Date.now() / 1_000);
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1_000);

  if (expiresAtSeconds <= issuedAtSeconds) {
    throw new TokenValidationError();
  }

  return jwt.sign(
    { tokenType: 'refresh', familyId, iat: issuedAtSeconds, exp: expiresAtSeconds },
    refreshSecret,
    {
      algorithm: 'HS512',
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      subject: userId,
      jwtid: jti
    }
  );
};

export const verifyAccessToken = (token: string): AccessTokenClaims => {
  const payload = verifiedPayload(token, accessSecret);

  if (payload.tokenType !== 'access' || !isUuid(payload.sub) || !isUuid(payload.jti) || !isRole(payload.role)) {
    throw new TokenValidationError();
  }

  return { userId: payload.sub, jti: payload.jti, role: payload.role };
};

export const verifyRefreshToken = (token: string): RefreshTokenClaims => {
  const payload = verifiedPayload(token, refreshSecret);

  if (payload.tokenType !== 'refresh' || !isUuid(payload.sub) || !isUuid(payload.jti) || !isUuid(payload.familyId)) {
    throw new TokenValidationError();
  }

  return { userId: payload.sub, jti: payload.jti, familyId: payload.familyId };
};

export const hashRefreshToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

export const normalizeUserAgent = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }

  const normalized = Array.from(value).filter((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && !((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159));
  }).join('').normalize('NFKC').trim();

  if (normalized.length === 0) {
    return null;
  }

  return Array.from(normalized).slice(0, 512).join('');
};

export const refreshCookieOptions = (remainingLifetimeMs: number): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    path: '/api/v1/auth',
    secure: config.NODE_ENV === 'production',
    maxAge: Math.max(0, remainingLifetimeMs)
  };

  if (config.COOKIE_DOMAIN.length > 0) {
    options.domain = config.COOKIE_DOMAIN;
  }

  return options;
};

export const clearRefreshCookieOptions = (): CookieOptions => refreshCookieOptions(0);
