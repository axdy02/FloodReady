import type { RequestHandler } from "express";
import { liveness, readiness, servicesReadiness } from "./health.service.js";

export const health: RequestHandler = (request, response) => {
  response.status(200).json({ success: true, data: liveness(), requestId: request.requestId });
};

export const ready: RequestHandler = async (request, response) => {
  response.status(200).json({ success: true, data: await readiness(), requestId: request.requestId });
};

export const services: RequestHandler = async (request, response) => {
  response.status(200).json({ success: true, data: await servicesReadiness(), requestId: request.requestId });
};
