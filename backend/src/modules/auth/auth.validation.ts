import { z, ZodError } from 'zod';

import { AppError } from '../../shared/errors/index.js';

import type { LoginInput, RegisterInput } from './auth.types.js';

const normalizeName = (value: string): string => value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const passwordSchema = z.string().superRefine((value, context) => {
  const scalarCount = Array.from(value).length;

  if (scalarCount < 12 || scalarCount > 128 || Buffer.byteLength(value, 'utf8') > 512) {
    context.addIssue({ code: 'custom', message: 'Invalid value' });
  }
});

const nameSchema = z
  .string()
  .transform(normalizeName)
  .refine((value) => Array.from(value).length >= 2 && Array.from(value).length <= 100, 'Invalid value');

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .refine((value) => value.length <= 254 && z.email().safeParse(value).success, 'Invalid value');

const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema
  })
  .strict();

const loginSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema
  })
  .strict();

const parse = <T>(schema: z.ZodType<T>, input: unknown, location: string): T => {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: `${location}.${issue.path.map((part) => String(part)).join('.')}`,
        message: 'Invalid value'
      }));

      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request', details);
    }

    throw error;
  }
};

export const parseRegisterInput = (input: unknown): RegisterInput => parse(registerSchema, input, 'body');

export const parseLoginInput = (input: unknown): LoginInput => parse(loginSchema, input, 'body');

export const normalizeNameInput = (value: string): string => normalizeName(value);
