import type { AuthRole } from '../../shared/security/index.js';
import type { KeysetPage, SortDirection } from '../../shared/types/pagination.js';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileInput {
  name: string;
}

export interface UpdateUserInput {
  role?: AuthRole;
  isActive?: boolean;
}

export interface UserListQuery {
  role: AuthRole | null;
  isActive: boolean | null;
  limit: number;
  sort: SortDirection;
  cursor: string | null;
}

export type UserCollection = KeysetPage<UserDto>;

export const toUserDto = (user: UserRecord): UserDto => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});
