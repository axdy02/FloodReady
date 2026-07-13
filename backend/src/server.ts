import { createServer, type Server } from "node:http";
import { app } from "./app.js";
import { config } from "./config/index.js";
import { prisma } from "./database/prisma.js";
import { initializeRuntimeDependencies } from "./modules/health/health.service.js";
import { logger } from "./shared/logging/index.js";

const listen = async (server: Server): Promise<void> => new Promise((resolve, reject) => {
  const onError = (error: Error): void => {
    server.off("listening", onListening);
    reject(error);
  };
  const onListening = (): void => {
    server.off("error", onError);
    resolve();
  };
  server.once("error", onError);
  server.once("listening", onListening);
  server.listen(config.PORT);
});

const shutdownServer = (server: Server): void => {
  let closing = false;
  const beginShutdown = (requestedExitCode: number): void => {
    if (closing) {
      process.exit(1);
      return;
    }
    closing = true;
    const timeout = setTimeout(() => {
      server.closeAllConnections();
      void prisma.$disconnect().finally(() => {
        process.exit(1);
      });
    }, config.SHUTDOWN_TIMEOUT_MS);
    server.close(() => {
      clearTimeout(timeout);
      void prisma.$disconnect().then(
        () => {
          process.exitCode = requestedExitCode;
        },
        () => {
          process.exitCode = 1;
        }
      );
    });
  };
  process.on("SIGTERM", () => beginShutdown(0));
  process.on("SIGINT", () => beginShutdown(0));
  process.on("uncaughtException", (error) => {
    logger.fatal({ errorType: error.name }, "uncaught exception");
    beginShutdown(1);
  });
  process.on("unhandledRejection", () => {
    logger.fatal({ errorType: "UnhandledRejection" }, "unhandled rejection");
    beginShutdown(1);
  });
};

export const startServer = async (): Promise<Server> => {
  await initializeRuntimeDependencies();
  const server = createServer(app);
  shutdownServer(server);
  await listen(server);
  return server;
};

void startServer().catch(async (error: unknown) => {
  console.error("\n--- FULL STARTUP ERROR ---");
  console.error(error);
  console.error("--------------------------\n");
  logger.fatal({ errorType: error instanceof Error ? error.name : "StartupFailure" }, "startup failed");
  await prisma.$disconnect();
  process.exitCode = 1;
});