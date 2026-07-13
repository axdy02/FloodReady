import type { RequestHandler } from "express";

const sensitivePrefix = /^\/api\/v1\/(auth|reports|users)(?:\/|$)/u;

export const noStoreSensitiveResponses: RequestHandler = (request, response, next) => {
  if (sensitivePrefix.test(request.path)) {
    response.setHeader("Cache-Control", "no-store");
  }
  next();
};
