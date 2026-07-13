import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

import { config } from "../../src/config/index.js";
import { api } from "../helpers/http.js";
import { expectError, expectRequestId, responseObject } from "./contracts.js";

const configurationEnvironment = (): NodeJS.ProcessEnv => {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(config)) {
    if (key === "accessTokenTtlMs" || key === "refreshTokenTtlMs") {
      continue;
    }
    environment[key] = Array.isArray(value) ? value.join(",") : String(value);
  }
  return environment;
};

const childExitCode = async (environment: NodeJS.ProcessEnv): Promise<number | null> => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", "import('./src/config/env.ts')"], {
    env: environment,
    stdio: "ignore"
  });
  child.once("error", reject);
  child.once("close", resolve);
});

describe("app foundation", () => {
  it("fails configuration validation before an app can be built", async () => {
    const environment = configurationEnvironment();
    delete environment.DATABASE_URL;

    await expect(childExitCode(environment)).resolves.not.toBe(0);
  });

  it("uses safe envelopes and generated request identifiers on unmatched routes", async () => {
    const response = await api().get("/api/v1/not-a-route");

    const error = expectError(response, 404, "NOT_FOUND");
    expect(error["message"]).toBe("Resource not found");
    expect(error["details"]).toEqual([]);
  });

  it("echoes a valid request ID and replaces hostile request IDs", async () => {
    const validId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const accepted = await api().get("/api/v1/health").set("X-Request-Id", validId);
    const rejected = await api().get("/api/v1/health").set("X-Request-Id", "password=should-not-appear");

    expect(expectRequestId(accepted)).toBe(validId);
    expect(expectRequestId(rejected)).not.toBe("password=should-not-appear");
  });

  it("sanitizes malformed JSON errors and hides request input", async () => {
    const hostileValue = "password=untrusted-secret";
    const response = await api()
      .post("/api/v1/auth/register")
      .set("Content-Type", "application/json")
      .send(`{${hostileValue}`);

    const error = expectError(response, 400, "VALIDATION_ERROR");
    const serialized = JSON.stringify(responseObject(response));
    expect(serialized).not.toContain(hostileValue);
    expect(error["details"]).toEqual([]);
  });
});
