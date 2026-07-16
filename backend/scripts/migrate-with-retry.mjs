import { spawn } from "node:child_process";

const attempts = 5;

const runMigration = () => new Promise((resolve) => {
  const child = spawn("npm", ["run", "prisma:migrate:deploy"], { shell: false, stdio: "inherit" });
  child.once("error", () => resolve(1));
  child.once("exit", (code) => resolve(code ?? 1));
});

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const exitCode = await runMigration();
  if (exitCode === 0) {
    break;
  }
  if (attempt === attempts) {
    process.exitCode = 1;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}
