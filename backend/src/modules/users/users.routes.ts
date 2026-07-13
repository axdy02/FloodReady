import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate.js';
import { requireRoles } from '../../middleware/authorize.js';
import { parseJsonBody, requireJsonContentType } from '../../middleware/content-type.js';

import {
  getMeController,
  getUserController,
  listUsersController,
  updateMeController,
  updateUserController
} from './users.controller.js';

export const usersRouter = Router();

usersRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

usersRouter.get('/me', authenticate, getMeController);
usersRouter.patch('/me', requireJsonContentType, parseJsonBody, authenticate, updateMeController);
usersRouter.get('/', authenticate, requireRoles('ADMIN'), listUsersController);
usersRouter.get('/:userId', authenticate, requireRoles('ADMIN'), getUserController);
usersRouter.patch('/:userId', requireJsonContentType, parseJsonBody, authenticate, requireRoles('ADMIN'), updateUserController);
