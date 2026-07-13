import { Router } from "express";
import { getController, listController } from "./incidents.controller.js";

export const incidentsRouter = Router();
incidentsRouter.get("/", listController);
incidentsRouter.get("/:incidentId", getController);
