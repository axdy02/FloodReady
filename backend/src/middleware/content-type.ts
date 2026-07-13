import express, { type RequestHandler } from 'express';

import { config } from '../config/index.js';
import { AppError } from '../shared/errors/index.js';

const validationError = (): AppError => new AppError(400, 'VALIDATION_ERROR', 'Invalid request');

export const requireJsonContentType: RequestHandler = (request, _response, next) => {
  if (!request.is('application/json')) {
    next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type'));
    return;
  }

  next();
};

export const requireMultipartContentType: RequestHandler = (request, _response, next) => {
  if (!request.is('multipart/form-data')) {
    next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type'));
    return;
  }

  next();
};

export const rejectRequestBody: RequestHandler = (request, _response, next) => {
  const contentLength = request.header('content-length');
  const transferEncoding = request.header('transfer-encoding');
  const length = contentLength === undefined ? 0 : Number(contentLength);

  if (transferEncoding !== undefined || !Number.isSafeInteger(length) || length < 0 || length > 0) {
    next(validationError());
    return;
  }

  next();
};

export const parseJsonBody = express.json({
  limit: `${config.JSON_BODY_LIMIT_KB}kb`,
  strict: true
});
