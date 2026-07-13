import type { RequestHandler } from 'express';

import { prisma } from '../database/prisma.js';
import { AppError } from '../shared/errors/index.js';
import { TokenValidationError, verifyAccessToken } from '../shared/security/index.js';

const bearerPattern = /^Bearer ([A-Za-z0-9._~-]+)$/;

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.header('authorization');
  const match = authorization === undefined ? null : bearerPattern.exec(authorization);

  if (match === null || match[1] === undefined) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required'));
    return;
  }

  try {
    const claims = verifyAccessToken(match[1]);
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (user === null || !user.isActive) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    request.user = user;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof TokenValidationError) {
      next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required'));
      return;
    }

    next(error);
  }
};
