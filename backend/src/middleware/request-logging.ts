import type { RequestHandler } from 'express';

import { logger } from '../shared/logging/index.js';

const routeTemplate = (request: Parameters<RequestHandler>[0]): string => {
  const routePath = request.route?.path;

  if (typeof routePath !== 'string') {
    return 'UNMATCHED';
  }

  return `${request.baseUrl}${routePath}`;
};

export const requestLogging: RequestHandler = (request, response, next) => {
  const startedAt = process.hrtime.bigint();

  response.once('finish', () => {
    const event: {
      requestId: string;
      method: string;
      route: string;
      statusCode: number;
      durationMs: number;
      userId?: string;
    } = {
      requestId: request.requestId,
      method: request.method,
      route: routeTemplate(request),
      statusCode: response.statusCode,
      durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000
    };

    if (request.user !== undefined) {
      event.userId = request.user.id;
    }

    logger.info(event);
  });

  next();
};
