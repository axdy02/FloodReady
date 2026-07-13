import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/index.js';

import { getMe, getUser, getUsers, updateManagedUser, updateMe } from './users.service.js';
import { parseAdminUpdate, parseProfileUpdate, parseUserId, parseUserListQuery } from './users.validation.js';

const noStore = (response: Parameters<RequestHandler>[1]): void => {
  response.setHeader('Cache-Control', 'no-store');
};

const currentUserId = (request: Parameters<RequestHandler>[0]): string => {
  if (request.user === undefined) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
  }

  return request.user.id;
};

export const getMeController: RequestHandler = async (request, response, next) => {
  try {
    const user = await getMe(currentUserId(request));
    noStore(response);
    response.status(200).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const updateMeController: RequestHandler = async (request, response, next) => {
  try {
    const user = await updateMe(currentUserId(request), parseProfileUpdate(request.body), request.ip ?? '0.0.0.0');
    noStore(response);
    response.status(200).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const listUsersController: RequestHandler = async (request, response, next) => {
  try {
    const users = await getUsers(parseUserListQuery(request.query));
    noStore(response);
    response.status(200).json({ success: true, data: users, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const getUserController: RequestHandler = async (request, response, next) => {
  try {
    const user = await getUser(parseUserId(request.params.userId));
    noStore(response);
    response.status(200).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const updateUserController: RequestHandler = async (request, response, next) => {
  try {
    const user = await updateManagedUser(
      currentUserId(request),
      parseUserId(request.params.userId),
      parseAdminUpdate(request.body),
      request.ip ?? '0.0.0.0'
    );
    noStore(response);
    response.status(200).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};
