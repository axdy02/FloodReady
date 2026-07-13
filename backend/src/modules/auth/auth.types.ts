import type { AuthRole } from '../../shared/security/index.js';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: UserDto;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthenticatedUserRecord {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LoginUserRecord extends AuthenticatedUserRecord {
  passwordHash: string;
  failedLoginAttempts: number;
  failedLoginWindowStartedAt: Date | null;
  lockedUntil: Date | null;
}

export interface RefreshSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export const toUserDto = (user: AuthenticatedUserRecord): UserDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});
