import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { parseJsonBody, rejectRequestBody, requireJsonContentType } from '../../middleware/content-type.js';
import { requireRefreshOrigin } from '../../middleware/origin-guard.js';
import { authRateLimit, refreshRateLimit } from '../../middleware/rate-limit.js';

import {
  loginController,
  logoutController,
  meController,
  refreshController,
  registerController
} from './auth.controller.js';

export const authRouter = Router();

authRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

authRouter.post('/register', authRateLimit, requireJsonContentType, parseJsonBody, registerController);
authRouter.post('/login', authRateLimit, requireJsonContentType, parseJsonBody, loginController);
authRouter.post('/refresh', refreshRateLimit, requireRefreshOrigin, rejectRequestBody, refreshController);
authRouter.post('/logout', refreshRateLimit, requireRefreshOrigin, rejectRequestBody, logoutController);
authRouter.get('/me', authenticate, meController);
