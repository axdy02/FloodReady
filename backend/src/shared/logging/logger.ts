import pino from "pino";
import { config } from "../../config/index.js";

export const logger = pino({
  level: config.LOG_LEVEL,
  base: null,
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "authorization", "cookie", "password", "passwordHash", "token", "accessToken", "refreshToken"]
});
