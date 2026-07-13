import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/index.js";
import { errorHandler } from "./middleware/error-handler.js";
import { generalRateLimit } from "./middleware/rate-limit.js";
import { notFound } from "./middleware/not-found.js";
import { noStoreSensitiveResponses } from "./middleware/no-store.js";
import { rejectUnknownOrigin } from "./middleware/origin-guard.js";
import { requestId } from "./middleware/request-id.js";
import { requestLogging } from "./middleware/request-logging.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY_HOPS);
app.use(requestId);
app.use(noStoreSensitiveResponses);
app.use(requestLogging);
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc: ["'none'"] } },
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: config.NODE_ENV === "production" ? {} : false
}));
app.use(rejectUnknownOrigin);
app.use(cors({ origin: [...config.CORS_ORIGINS], credentials: true, methods: ["GET", "POST", "PATCH", "OPTIONS"], allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"] }));
app.use(generalRateLimit);
app.use(cookieParser());
app.use("/api/v1", apiRouter);
app.use(notFound);
app.use(errorHandler);
