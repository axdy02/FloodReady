import { Router } from "express";
import { health, ready, services } from "./health.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export const healthRouter = Router();
healthRouter.get("/health", health);
healthRouter.get("/health/ready", ready);
healthRouter.get("/health/services", authenticate, services);
