import type { RequestHandler } from 'express';

import { AppError } from '../../shared/errors/index.js';
import { clearRefreshCookieOptions, refreshCookieOptions } from '../../shared/security/index.js';

import { getCurrentUser, login, logout, refresh, register } from './auth.service.js';
import { parseLoginInput, parseRegisterInput } from './auth.validation.js';

const requestContext = (request: Parameters<RequestHandler>[0]): { ipAddress: string; userAgent: string | undefined } => ({
  ipAddress: request.ip ?? '0.0.0.0',
  userAgent: request.header('user-agent')
});

const refreshCookie = (request: Parameters<RequestHandler>[0]): string | undefined => {
  const value: unknown = request.cookies?.floodready_refresh;

  return typeof value === 'string' ? value : undefined;
};

const noStore = (response: Parameters<RequestHandler>[1]): void => {
  response.setHeader('Cache-Control', 'no-store');
};

export const registerController: RequestHandler = async (request, response, next) => {
  try {
    const user = await register(parseRegisterInput(request.body), requestContext(request));
    noStore(response);
    response.status(201).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const loginController: RequestHandler = async (request, response, next) => {
  try {
    const result = await login(parseLoginInput(request.body), requestContext(request));
    noStore(response);
    response.cookie(
      'floodready_refresh',
      result.refreshToken,
      refreshCookieOptions(result.refreshExpiresAt.getTime() - Date.now())
    );
    response.status(200).json({ success: true, data: result.auth, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const refreshController: RequestHandler = async (request, response, next) => {
  try {
    const rawToken = refreshCookie(request);

    if (rawToken === undefined) {
      noStore(response);
      response.cookie('floodready_refresh', '', clearRefreshCookieOptions());
      next(new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token'));
      return;
    }

    const result = await refresh(rawToken, requestContext(request));

    if (result.kind === 'invalid') {
      noStore(response);
      response.cookie('floodready_refresh', '', clearRefreshCookieOptions());
      next(new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token'));
      return;
    }

    noStore(response);
    response.cookie(
      'floodready_refresh',
      result.refreshToken,
      refreshCookieOptions(result.refreshExpiresAt.getTime() - Date.now())
    );
    response.status(200).json({ success: true, data: result.auth, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const logoutController: RequestHandler = async (request, response, next) => {
  try {
    await logout(refreshCookie(request), { ipAddress: request.ip ?? '0.0.0.0' });
    noStore(response);
    response.cookie('floodready_refresh', '', clearRefreshCookieOptions());
    response.status(200).json({ success: true, data: null, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};

export const meController: RequestHandler = async (request, response, next) => {
  try {
    if (request.user === undefined) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    const user = await getCurrentUser(request.user.id);
    noStore(response);
    response.status(200).json({ success: true, data: user, requestId: request.requestId });
  } catch (error) {
    next(error);
  }
};
