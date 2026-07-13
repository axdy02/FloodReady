import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { config } from "../config/index.js";

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
  max: config.DB_POOL_MAX,
  connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
  query_timeout: config.DB_QUERY_TIMEOUT_MS,
  statement_timeout: config.DB_QUERY_TIMEOUT_MS
});

export const prisma = new PrismaClient({ adapter });
