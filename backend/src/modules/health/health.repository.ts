import { Pool, type PoolClient } from "pg";
import { config } from "../../config/index.js";

export const probeDatabase = async (): Promise<void> => {
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 750,
    idleTimeoutMillis: 750,
    query_timeout: 750,
    statement_timeout: 750
  });
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("SELECT 1, PostGIS_Version()");
  } finally {
    client?.release();
    await pool.end();
  }
};
