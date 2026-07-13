import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const postgisImage = "postgis/postgis:18-3.6@sha256:f248a10d133f63d01aefab324f3462d7e1002e9cc1b65c6585626f6cb7a3d85c";
const npmCli = process.platform === "win32"
  ? resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
  : resolve(dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
const containerName = `floodready-test-${process.pid}-${randomBytes(6).toString("hex")}`;
const databaseName = "floodready_test";
const databaseUser = "floodready_test_user";
const databasePassword = randomBytes(24).toString("base64url");
let uploadDirectory = "";
let containerStarted = false;
let cleaning = false;

const run = (command, args, options = {}) => new Promise((resolve) => {
  const child = spawn(command, args, { shell: false, stdio: options.stdio ?? "inherit", env: options.env });
  child.once("error", () => resolve({ code: 127, stdout: "", unavailable: true }));
  let stdout = "";
  if (child.stdout !== null) {
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
  }
  child.once("close", (code) => resolve({ code: code ?? 1, stdout }));
});

const requireSuccess = async (command, args, options = {}) => {
  const result = await run(command, args, options);
  if (result.code !== 0) {
    throw new Error(result.unavailable === true ? `Required isolated test command is unavailable: ${command}` : `Required isolated test command failed: ${command}`);
  }
  return result.stdout;
};

const runNpm = async (argumentsForNpm, environment) => requireSuccess(process.execPath, [npmCli, ...argumentsForNpm], { env: environment });

const testEnvironment = (databaseUrl) => ({
  ...process.env,
  NODE_ENV: "test",
  PORT: "3100",
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  DB_POOL_MAX: "4",
  DB_CONNECTION_TIMEOUT_MS: "2000",
  DB_IDLE_TIMEOUT_MS: "10000",
  DB_QUERY_TIMEOUT_MS: "5000",
  ACCESS_TOKEN_SECRET: randomBytes(64).toString("base64url"),
  REFRESH_TOKEN_SECRET: randomBytes(64).toString("base64url"),
  ACCESS_TOKEN_TTL: "15m",
  REFRESH_TOKEN_TTL: "30d",
  JWT_ISSUER: "floodready-test",
  JWT_AUDIENCE: "floodready-test-api",
  PUBLIC_API_ORIGIN: "http://127.0.0.1:3100",
  CORS_ORIGINS: "http://127.0.0.1:3100",
  COOKIE_DOMAIN: "",
  UPLOAD_DIRECTORY: uploadDirectory,
  MAX_UPLOAD_SIZE_MB: "10",
  MAX_IMAGE_PIXELS: "20000000",
  UPLOAD_PROCESSING_CONCURRENCY: "2",
  UPLOAD_QUEUE_MAX: "8",
  JSON_BODY_LIMIT_KB: "100",
  RATE_LIMIT_WINDOW_MS: "900000",
  RATE_LIMIT_MAX_REQUESTS: "10000",
  AUTH_RATE_LIMIT_WINDOW_MS: "900000",
  AUTH_RATE_LIMIT_MAX_REQUESTS: "100",
  REPORT_RATE_LIMIT_WINDOW_MS: "3600000",
  REPORT_RATE_LIMIT_MAX_REQUESTS: "100",
  LOGIN_FAILURE_WINDOW_MS: "900000",
  LOGIN_FAILURE_MAX: "5",
  LOGIN_LOCK_MS: "900000",
  TRUST_PROXY_HOPS: "0",
  SHUTDOWN_TIMEOUT_MS: "10000",
  LOG_LEVEL: "fatal"
});

const parsePublishedPort = (value) => {
  const match = /:([1-9][0-9]{0,4})\s*$/u.exec(value);
  if (match === null || match[1] === undefined) {
    throw new Error("Isolated PostGIS port was not published");
  }
  return match[1];
};

const waitForDatabase = async () => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = await run("docker", ["exec", containerName, "pg_isready", "-U", databaseUser, "-d", databaseName], { stdio: "ignore" });
    if (result.code === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Isolated PostGIS database did not become ready");
};

const cleanup = async () => {
  if (cleaning) {
    return;
  }
  cleaning = true;
  if (containerStarted) {
    await run("docker", ["rm", "--force", containerName], { stdio: "ignore" });
  }
  if (uploadDirectory.length > 0) {
    await rm(uploadDirectory, { force: true, recursive: true });
  }
};

const stop = () => {
  void cleanup().finally(() => {
    process.exitCode = 1;
  });
};

const main = async () => {
  uploadDirectory = await mkdtemp(join(tmpdir(), "floodready-test-"));
  await requireSuccess("docker", [
    "run",
    "--detach",
    "--rm",
    "--name",
    containerName,
    "--publish",
    "127.0.0.1::5432",
    "--env",
    `POSTGRES_DB=${databaseName}`,
    "--env",
    `POSTGRES_USER=${databaseUser}`,
    "--env",
    `POSTGRES_PASSWORD=${databasePassword}`,
    postgisImage
  ]);
  containerStarted = true;
  await waitForDatabase();
  const published = await requireSuccess("docker", ["port", containerName, "5432/tcp"], { stdio: "pipe" });
  const port = parsePublishedPort(published);
  const databaseUrl = `postgresql://${databaseUser}:${encodeURIComponent(databasePassword)}@127.0.0.1:${port}/${databaseName}`;
  const environment = testEnvironment(databaseUrl);
  const parsed = new URL(environment.TEST_DATABASE_URL);
  if (environment.NODE_ENV !== "test" || !parsed.pathname.endsWith("_test")) {
    throw new Error("Unsafe test database configuration");
  }
  await runNpm(["run", "prisma:generate"], environment);
  await runNpm(["run", "prisma:migrate:deploy"], environment);
  const argumentsAfterRunner = process.argv.slice(2);
  const watchIndex = argumentsAfterRunner.indexOf("--watch");
  const testArguments = argumentsAfterRunner.filter((argument) => argument !== "--watch");
  if (watchIndex >= 0) {
    await requireSuccess(process.execPath, ["./node_modules/vitest/vitest.mjs", "--watch", ...testArguments], { env: environment });
  } else {
    await runNpm(["run", "test:vitest", "--", ...testArguments], environment);
  }
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "Isolated test runner failed"}\n`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
