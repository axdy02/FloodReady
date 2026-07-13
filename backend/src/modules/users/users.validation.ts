import { z, ZodError } from 'zod';

import { AppError } from '../../shared/errors/index.js';
import { normalizeNameInput } from '../auth/auth.validation.js';
import type { UpdateProfileInput, UpdateUserInput, UserListQuery } from './users.types.js';

const roleSchema = z.enum(['USER', 'MODERATOR', 'ADMIN']);
const uuidSchema = z.string().uuid();
const positiveInteger = /^[1-9][0-9]*$/;

const nameSchema = z
  .string()
  .transform(normalizeNameInput)
  .refine((value) => Array.from(value).length >= 2 && Array.from(value).length <= 100, 'Invalid value');

const profileSchema = z.object({ name: nameSchema }).strict();

const adminUpdateSchema = z
  .object({
    role: roleSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict()
  .refine((value) => value.role !== undefined || value.isActive !== undefined, 'Invalid value');

const booleanQuerySchema = z
  .string()
  .refine((value) => value === 'true' || value === 'false', 'Invalid value')
  .transform((value) => value === 'true');

const userListQuerySchema = z
  .object({
    role: roleSchema.optional(),
    isActive: booleanQuerySchema.optional(),
    limit: z
      .string()
      .refine((value) => positiveInteger.test(value), 'Invalid value')
      .transform((value) => Number(value))
      .refine((value) => value >= 1 && value <= 100, 'Invalid value')
      .optional(),
    sort: z.enum(['asc', 'desc']).optional(),
    cursor: z.string().min(1).max(512).optional()
  })
  .strict();

const parse = <T>(schema: z.ZodType<T>, input: unknown, location: string): T => {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.length === 0 ? location : `${location}.${issue.path.map((part) => String(part)).join('.')}`,
        message: 'Invalid value'
      }));

      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details);
    }

    throw error;
  }
};

export const parseProfileUpdate = (input: unknown): UpdateProfileInput => parse(profileSchema, input, 'body');

export const parseAdminUpdate = (input: unknown): UpdateUserInput => {
  const parsed = parse(adminUpdateSchema, input, 'body');
  const result: UpdateUserInput = {};

  if (parsed.role !== undefined) {
    result.role = parsed.role;
  }

  if (parsed.isActive !== undefined) {
    result.isActive = parsed.isActive;
  }

  return result;
};

export const parseUserId = (input: unknown): string => parse(uuidSchema, input, 'params.userId');

export const parseUserListQuery = (input: unknown): UserListQuery => {
  const parsed = parse(userListQuerySchema, input, 'query');

  return {
    role: parsed.role ?? null,
    isActive: parsed.isActive ?? null,
    limit: parsed.limit ?? 20,
    sort: parsed.sort ?? 'desc',
    cursor: parsed.cursor ?? null
  };
};
