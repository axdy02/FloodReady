import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { CursorPayload, CursorResource, SortDirection } from '../types/pagination.js';

const cursorInputPattern = /^[A-Za-z0-9_-]+$/;
const cursorTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const lowercaseUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const filterHashPattern = /^[0-9a-f]{64}$/;

const standardCursorPayloadSchema = z
  .object({
    v: z.literal(1),
    resource: z.enum(['users', 'reports', 'ownReports', 'incidents']),
    sort: z.enum(['asc', 'desc']),
    timestamp: z.string().regex(cursorTimestampPattern),
    id: z.string().regex(lowercaseUuidPattern),
    filterHash: z.string().regex(filterHashPattern)
  })
  .strict();

const reportMapCursorPayloadSchema = z
  .object({
    v: z.literal(1),
    resource: z.literal('reportMap'),
    sort: z.enum(['asc', 'desc']),
    timestamp: z.string().regex(cursorTimestampPattern),
    id: z.string().regex(lowercaseUuidPattern),
    filterHash: z.string().regex(filterHashPattern),
    actorId: z.string().regex(lowercaseUuidPattern)
  })
  .strict();

const cursorPayloadSchema = z.union([standardCursorPayloadSchema, reportMapCursorPayloadSchema]);

export class CursorValidationError extends Error {
  public constructor() {
    super('Invalid cursor');
    this.name = 'CursorValidationError';
  }
}

const isCanonicalTimestamp = (value: string): boolean => {
  const parsed = new Date(value);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
};

const serializePayload = (payload: CursorPayload): string => payload.resource === 'reportMap'
  ? JSON.stringify({
    v: payload.v,
    resource: payload.resource,
    sort: payload.sort,
    timestamp: payload.timestamp,
    id: payload.id,
    filterHash: payload.filterHash,
    actorId: payload.actorId
  })
  : JSON.stringify({
    v: payload.v,
    resource: payload.resource,
    sort: payload.sort,
    timestamp: payload.timestamp,
    id: payload.id,
    filterHash: payload.filterHash
  });

const decodeBase64Url = (value: string): string => {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new CursorValidationError();
  }
};

const parsePayload = (serialized: string): CursorPayload => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new CursorValidationError();
  }

  const result = cursorPayloadSchema.safeParse(parsed);

  if (!result.success || !isCanonicalTimestamp(result.data.timestamp)) {
    throw new CursorValidationError();
  }

  return result.data;
};

export const encodeCursor = (payload: CursorPayload): string => {
  if (!isCanonicalTimestamp(payload.timestamp)) {
    throw new CursorValidationError();
  }

  const result = cursorPayloadSchema.safeParse(payload);

  if (!result.success) {
    throw new CursorValidationError();
  }

  return Buffer.from(serializePayload(result.data), 'utf8').toString('base64url');
};

export const decodeCursor = (value: string): CursorPayload => {
  if (value.length < 1 || value.length > 512 || !cursorInputPattern.test(value)) {
    throw new CursorValidationError();
  }

  const serialized = decodeBase64Url(value);
  const payload = parsePayload(serialized);
  const canonicalSerialized = serializePayload(payload);
  const canonicalEncoded = Buffer.from(canonicalSerialized, 'utf8').toString('base64url');

  if (serialized !== canonicalSerialized || value !== canonicalEncoded) {
    throw new CursorValidationError();
  }

  return payload;
};

const normalizeFilterValue = (value: unknown): unknown => {
  if (typeof value === 'number') {
    return Object.is(value, -0) ? 0 : value;
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFilterValue);
  }

  if (value !== null && typeof value === 'object') {
    const normalized: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      normalized[key] = normalizeFilterValue(nested);
    }

    return normalized;
  }

  return value;
};

export const hashFilters = (filters: object): string =>
  createHash('sha256').update(JSON.stringify(normalizeFilterValue(filters)), 'utf8').digest('hex');

export const validateCursor = (
  value: string,
  resource: CursorResource,
  sort: SortDirection,
  filters: object,
  actorId?: string
): CursorPayload => {
  const payload = decodeCursor(value);

  if (payload.resource !== resource || payload.sort !== sort || payload.filterHash !== hashFilters(filters)) {
    throw new CursorValidationError();
  }

  if (resource === 'reportMap' && (actorId === undefined || payload.resource !== 'reportMap' || payload.actorId !== actorId)) {
    throw new CursorValidationError();
  }

  return payload;
};
