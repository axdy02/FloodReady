import request from "supertest";
import { app } from "../../src/app.js";

export const api = (): ReturnType<typeof request> => request(app);
