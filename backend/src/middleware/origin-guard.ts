import type { RequestHandler } from 'express';

import { config } from '../config/index.js';
import { AppError } from '../shared/errors/index.js';

const originNotAllowed = (): AppError => new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed');

const allowedOrigin = (origin: string): boolean => config.CORS_ORIGINS.includes(origin);

export const rejectUnknownOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.header('origin');

  if (origin !== undefined && !allowedOrigin(origin)) {
    next(originNotAllowed());
    return;
  }

  next();
};

export const requireRefreshOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.header('origin');

  if (config.NODE_ENV === 'production' && (origin === undefined || !allowedOrigin(origin))) {
    next(originNotAllowed());
    return;
  }

  next();
};

export const isAllowedOrigin = allowedOrigin;
