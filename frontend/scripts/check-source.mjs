import { readdirSync, readFileSync, lstatSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const extensions = new Set([".ts", ".tsx", ".mjs", ".json", ""]);
const forbidden = [
  [new RegExp(["TO", "DO", "|FIX", "ME"].join(""), "u"), "unfinished-marker"],
  [new RegExp(["\\b", "an", "y", "\\b"].join(""), "u"), "unsafe-type"],
  [/console\./u, "console"],
  [/process\.env(?!\[)/u, "environment-boundary"],
  [new RegExp(["local", "Storage|session", "Storage|indexed", "DB"].join(""), "u"), "client-storage"],
  [new RegExp(["dangerously", "SetInnerHTML"].join(""), "u"), "unsafe-html"],
  [/(?:\.only\(|\.skip\(|\.todo\()/u, "focused-test"]
];

function collect(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collect(file);
    }
    return extensions.has(path.extname(file)) ? [file] : [];
  });
}

export function scanPaths(paths) {
  const findings = [];
  for (const file of paths) {
    if (lstatSync(file).isSymbolicLink()) {
      findings.push({ file, rule: "symlink", line: 1 });
      continue;
    }
    const content = readFileSync(file, "utf8");
    for (const [pattern, rule] of forbidden) {
      if (rule === "environment-boundary" && [path.join(root, "src", "lib", "env", "client.ts"), path.join(root, "src", "lib", "env", "server.ts"), path.join(root, "scripts", "with-test-env.mjs")].includes(file)) {
        continue;
      }
      if (rule === "client-storage" && file === path.join(root, "src", "lib", "storage", "browser-storage.ts")) continue;
      const match = pattern.exec(content);
      if (match !== null) {
        findings.push({ file, rule, line: content.slice(0, match.index).split("\n").length });
      }
    }
  }
  return findings;
}

const files = [...collect(path.join(root, "src")), ...collect(path.join(root, "scripts")), path.join(root, "Dockerfile"), path.join(root, "next.config.ts"), path.join(root, "eslint.config.mjs"), path.join(root, "postcss.config.mjs"), path.join(root, "vitest.config.ts"), path.join(root, "playwright.config.ts"), path.join(root, "components.json")];
const findings = scanPaths(files);
for (const finding of findings) {
  process.stdout.write(`${path.relative(root, finding.file)}:${finding.line}:${finding.rule}\n`);
}
if (findings.length > 0) {
  process.exitCode = 1;
}
