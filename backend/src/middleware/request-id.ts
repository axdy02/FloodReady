import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const requestId = (request: Request, response: Response, next: NextFunction): void => {
  const incoming = request.header("x-request-id");
  request.requestId = incoming !== undefined && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incoming) ? incoming : randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
};
