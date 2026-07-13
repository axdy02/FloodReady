import type { RequestHandler } from 'express';

import { AppError } from '../shared/errors/index.js';
import type { AuthRole } from '../shared/security/index.js';

export const requireRoles = (...roles: AuthRole[]): RequestHandler => (request, _response, next) => {
  if (request.user === undefined || !request.user.isActive) {
    next(new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required'));
    return;
  }

  if (!roles.includes(request.user.role)) {
    next(new AppError(403, 'FORBIDDEN', 'Forbidden'));
    return;
  }

  next();
};
