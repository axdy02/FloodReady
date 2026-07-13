import { ipKeyGenerator, rateLimit, type Options } from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { config } from '../config/index.js';

const rateLimitHandler: NonNullable<Options['handler']> = (request, response) => {
  response.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests', details: [] },
    requestId: request.requestId
  });
};

const trustedIpKey = (request: { ip: string | undefined }): string => ipKeyGenerator(request.ip ?? '::');

const createRateLimiter = (windowMs: number, limit: number, skip?: NonNullable<Options['skip']>): RequestHandler => {
  const options: Partial<Options> = {
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: trustedIpKey,
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  };

  if (skip !== undefined) {
    options.skip = skip;
  }

  return rateLimit(options);
};

export const generalRateLimit = createRateLimiter(
  config.RATE_LIMIT_WINDOW_MS,
  config.RATE_LIMIT_MAX_REQUESTS,
  (request) => request.method === 'OPTIONS' || request.path === '/api/v1/health' || request.path === '/api/v1/health/ready'
);

export const authRateLimit = createRateLimiter(config.AUTH_RATE_LIMIT_WINDOW_MS, config.AUTH_RATE_LIMIT_MAX_REQUESTS);

export const refreshRateLimit = createRateLimiter(15 * 60 * 1_000, 30);

export const reportIpRateLimit = createRateLimiter(config.REPORT_RATE_LIMIT_WINDOW_MS, config.REPORT_RATE_LIMIT_MAX_REQUESTS);

export const createUserRateLimit = (): RequestHandler => {
  const limiter = rateLimit({
    windowMs: config.REPORT_RATE_LIMIT_WINDOW_MS,
    limit: config.REPORT_RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request) => request.user?.id ?? trustedIpKey(request),
    handler: rateLimitHandler,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  });

  return limiter;
};

export const createReportMapRateLimit = (): RequestHandler => rateLimit({
  windowMs: 900_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) => request.user?.id ?? '',
  handler: rateLimitHandler,
  skipSuccessfulRequests: false,
  skipFailedRequests: false
});
