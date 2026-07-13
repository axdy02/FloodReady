import { spawn } from "node:child_process";

const [project, envFile] = process.argv.slice(2);

if (project === undefined || envFile === undefined) {
  process.exitCode = 1;
} else {
  const run = (argumentsForCompose, capture = false) => new Promise((resolve) => {
    const child = spawn("docker", ["compose", "--project-name", project, "--env-file", envFile, ...argumentsForCompose], {
      shell: false,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit"
    });
    let stdout = "";
    if (child.stdout !== null) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
    }
    child.once("error", () => resolve({ code: 127, stdout: "" }));
    child.once("close", (code) => resolve({ code: code ?? 1, stdout }));
  });

  const states = async () => {
    const result = await run(["ps", "--all", "--format", "json"], true);
    if (result.code !== 0) {
      throw new Error("Unable to inspect Compose services");
    }
    const text = result.stdout.trim();
    if (text.length === 0) {
      throw new Error("Compose services are missing");
    }
    try {
      if (text.startsWith("[")) {
        return JSON.parse(text);
      }
      return text.split(/\r?\n/u).map((line) => JSON.parse(line));
    } catch {
      throw new Error("Compose service status is invalid");
    }
  };

  const service = (entries, name) => entries.find((entry) => entry.Service === name || entry.Name?.endsWith(`-${name}-1`));

  const healthy = (entry) => entry !== undefined && entry.State === "running" && entry.Health === "healthy";

  const waitForRuntime = async () => {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const entries = await states();
      const database = service(entries, "db");
      const backend = service(entries, "backend");
      const migration = service(entries, "migrate");
      const migrationFinished = migration !== undefined && migration.State === "exited" && Number(migration.ExitCode) === 0;
      const probesReady = await (async () => {
        try {
          const [healthResponse, readinessResponse] = await Promise.all([
            fetch("http://127.0.0.1:3000/api/v1/health"),
            fetch("http://127.0.0.1:3000/api/v1/health/ready")
          ]);
          return healthResponse.status === 200 && readinessResponse.status === 200;
        } catch {
          return false;
        }
      })();
      if (healthy(database) && healthy(backend) && migrationFinished && probesReady) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error("Compose health checks did not succeed");
  };

  try {
    await waitForRuntime();
    const uid = await run(["exec", "-T", "backend", "id", "-u"], true);
    const gid = await run(["exec", "-T", "backend", "id", "-g"], true);
    if (uid.code !== 0 || gid.code !== 0 || uid.stdout.trim() === "0" || uid.stdout.trim() !== "10001" || gid.stdout.trim() !== "10001") {
      throw new Error("Backend container is not running as the required non-root user");
    }
    process.stdout.write("Compose runtime checks passed\n");
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "Compose runtime verification failed"}\n`);
    process.exitCode = 1;
  }
}
