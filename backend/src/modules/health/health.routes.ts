import { Router } from "express";
import { health, ready } from "./health.controller.js";

export const healthRouter = Router();
healthRouter.get("/health", health);
healthRouter.get("/health/ready", ready);
