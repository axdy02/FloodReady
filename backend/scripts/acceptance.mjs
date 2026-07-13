import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const npmCli = process.platform === "win32"
  ? resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  : resolve(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
const acceptanceDirectory = ".acceptance";
const environmentFile = join(acceptanceDirectory, "compose.env");
const project = `floodready-acceptance-${process.pid}`;
const verifyOnly = process.argv.includes("--verify");
let composeLaunched = false;
let cleanupStarted = false;
let activeEnvironment = null;

const run = (command, args, environment) => new Promise((resolve) => {
  const child = spawn(command, args, { shell: false, stdio: "inherit", env: environment });
  child.once("error", () => resolve(127));
  child.once("exit", (code) => resolve(code ?? 1));
});

const requireSuccess = async (command, args, environment) => {
  const code = await run(command, args, environment);
  if (code !== 0) {
    throw new Error(`Required acceptance command failed: ${command}`);
  }
};

const runNpm = async (argumentsForNpm, environment) => requireSuccess(process.execPath, [npmCli, ...argumentsForNpm], environment);

const createEnvironment = () => {
  const databasePassword = randomBytes(24).toString("base64url");
  const databaseUser = "floodready_acceptance";
  const databaseName = "floodready_acceptance";
  const databaseUrl = `postgresql://${databaseUser}:${encodeURIComponent(databasePassword)}@db:5432/${databaseName}`;
  return {
    NODE_ENV: "production",
    PORT: "3000",
    DATABASE_URL: databaseUrl,
    DB_POOL_MAX: "10",
    DB_CONNECTION_TIMEOUT_MS: "2000",
    DB_IDLE_TIMEOUT_MS: "10000",
    DB_QUERY_TIMEOUT_MS: "5000",
    ACCESS_TOKEN_SECRET: randomBytes(64).toString("base64url"),
    REFRESH_TOKEN_SECRET: randomBytes(64).toString("base64url"),
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "30d",
    JWT_ISSUER: "floodready-acceptance",
    JWT_AUDIENCE: "floodready-acceptance-api",
    PUBLIC_API_ORIGIN: "https://localhost:3000",
    CORS_ORIGINS: "https://localhost:3000",
    COOKIE_DOMAIN: "",
    MAX_UPLOAD_SIZE_MB: "10",
    MAX_IMAGE_PIXELS: "20000000",
    UPLOAD_PROCESSING_CONCURRENCY: "2",
    UPLOAD_QUEUE_MAX: "8",
    JSON_BODY_LIMIT_KB: "100",
    RATE_LIMIT_WINDOW_MS: "900000",
    RATE_LIMIT_MAX_REQUESTS: "100",
    AUTH_RATE_LIMIT_WINDOW_MS: "900000",
    AUTH_RATE_LIMIT_MAX_REQUESTS: "20",
    REPORT_RATE_LIMIT_WINDOW_MS: "3600000",
    REPORT_RATE_LIMIT_MAX_REQUESTS: "10",
    LOGIN_FAILURE_WINDOW_MS: "900000",
    LOGIN_FAILURE_MAX: "5",
    LOGIN_LOCK_MS: "900000",
    TRUST_PROXY_HOPS: "0",
    SHUTDOWN_TIMEOUT_MS: "10000",
    LOG_LEVEL: "info",
    POSTGRES_DB: databaseName,
    POSTGRES_USER: databaseUser,
    POSTGRES_PASSWORD: databasePassword
  };
};

const serializeEnvironment = (environment) => Object.entries(environment).map(([key, value]) => `${key}=${value}`).join("\n");

const composeArguments = (...argumentsForCompose) => ["compose", "--project-name", project, "--env-file", environmentFile, ...argumentsForCompose];

const cleanup = async (environment) => {
  if (cleanupStarted) {
    return;
  }
  cleanupStarted = true;
  if (composeLaunched) {
    await run("docker", composeArguments("down", "--volumes", "--remove-orphans"), environment);
  }
  await rm(acceptanceDirectory, { force: true, recursive: true });
};

const main = async () => {
  const values = createEnvironment();
  const environment = { ...process.env, ...values };
  activeEnvironment = environment;
  await mkdir(acceptanceDirectory, { recursive: true, mode: 0o700 });
  await writeFile(environmentFile, serializeEnvironment(values), { encoding: "utf8", mode: 0o600 });
  try {
    await runNpm(["run", "lint"], environment);
    await runNpm(["run", "quality:source"], environment);
    await runNpm(["run", "typecheck"], environment);
    await runNpm(["run", "prisma:validate"], environment);
    await runNpm(["run", "build"], environment);
    await runNpm(["test"], environment);
    if (!verifyOnly) {
      await requireSuccess("docker", composeArguments("config"), environment);
      await requireSuccess("docker", composeArguments("build", "--no-cache"), environment);
      composeLaunched = true;
      await requireSuccess("docker", composeArguments("up", "--detach"), environment);
      await requireSuccess(process.execPath, ["scripts/verify-compose.mjs", project, environmentFile], environment);
    }
  } finally {
    await cleanup(environment);
  }
};

const terminate = () => {
  if (activeEnvironment === null) {
    process.exitCode = 1;
    return;
  }
  void cleanup(activeEnvironment).finally(() => {
    process.exit(1);
  });
};

process.once("SIGINT", terminate);
process.once("SIGTERM", terminate);

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Acceptance failed"}\n`);
  process.exitCode = 1;
}
