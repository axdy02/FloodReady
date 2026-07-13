import type { RequestHandler } from "express";

export const notFound: RequestHandler = (request, response) => {
  response.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Resource not found", details: [] }, requestId: request.requestId });
};
