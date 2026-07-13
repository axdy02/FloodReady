import { randomUUID } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";
import { createServer } from "node:http";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { config } from "../../src/config/index.js";
import { prisma } from "../../src/database/prisma.js";
import { api } from "../helpers/http.js";

const start = (server: ReturnType<typeof createServer>): Promise<void> => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve();
  });
});

const stop = (server: ReturnType<typeof createServer>): Promise<void> => new Promise((resolve, reject) => {
  server.close((error) => {
    if (error === undefined) {
      resolve();
      return;
    }
    reject(error);
  });
});

describe("health-runtime", () => {
  let displacedUploadDirectory: string | null = null;

  beforeAll(async () => {
    await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
  });

  afterEach(async () => {
    if (displacedUploadDirectory !== null) {
      await rename(displacedUploadDirectory, config.UPLOAD_DIRECTORY);
      displacedUploadDirectory = null;
    }
  });

  it("keeps liveness available after the real Prisma client disconnects", async () => {
    await prisma.$disconnect();
    const requestId = randomUUID();
    const response = await api()
      .get("/api/v1/health")
      .set("x-request-id", requestId)
      .expect(200);

    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ok", service: "floodready-backend" },
      requestId
    });
  });

  it("returns readiness only after real database and storage probes succeed", async () => {
    await mkdir(config.UPLOAD_DIRECTORY, { recursive: true });
    const response = await api().get("/api/v1/health/ready").expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ready", service: "floodready-backend" }
    });
  });

  it("returns a safe 503 envelope when the configured storage probe fails", async () => {
    const requestId = randomUUID();
    displacedUploadDirectory = `${config.UPLOAD_DIRECTORY}-${randomUUID()}`;
    await rename(config.UPLOAD_DIRECTORY, displacedUploadDirectory);

    const response = await api()
      .get("/api/v1/health/ready")
      .set("x-request-id", requestId)
      .expect(503);

    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(response.body).toEqual({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Service unavailable", details: [] },
      requestId
    });
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|postgres|database|stack|upload/i);
  });

  it("uses the standard safe envelope for unknown routes", async () => {
    const requestId = randomUUID();
    const response = await api()
      .get("/api/v1/no-such-route")
      .set("x-request-id", requestId)
      .expect(404);

    expect(response.headers["x-request-id"]).toBe(requestId);
    expect(response.body).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "Resource not found", details: [] },
      requestId
    });
    expect(JSON.stringify(response.body)).not.toMatch(/prisma|postgres|database|stack|upload/i);
  });

  it("serves a real socket and closes it cleanly", async () => {
    const server = createServer(app);
    await start(server);

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("Expected an IPv4 server address");
      }
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"status":"ok"');
    } finally {
      await stop(server);
    }

    expect(server.listening).toBe(false);
  });
});
