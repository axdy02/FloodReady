import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const names = ["FRONTEND_ENV", "NEXT_PUBLIC_API_BASE_URL", "INTERNAL_API_BASE_URL", "NEXT_PUBLIC_APP_ORIGIN", "NEXT_PUBLIC_MAP_STYLE_URL", "NEXT_PUBLIC_MAP_ATTRIBUTION", "NEXT_PUBLIC_MAP_CONNECT_ORIGINS", "NEXT_PUBLIC_MAP_IMAGE_ORIGINS", "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE", "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE", "NEXT_PUBLIC_DEFAULT_MAP_ZOOM", "NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB"];
const unsupported = /[\r\n\0#$\\"]/u;

function requireValue(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing launcher value: ${name}`);
  }
  return value;
}

function parseFixture() {
  const file = path.join(process.cwd(), ".env.test");
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) || !bytes.toString("utf8").endsWith("\n")) {
    throw new Error("Invalid test environment encoding");
  }
  const values = Object.create(null);
  const rows = bytes.toString("utf8").split("\n").slice(0, -1);
  if (rows.length !== names.length) {
    throw new Error("Invalid test environment keys");
  }
  for (const row of rows) {
    const separator = row.indexOf("=");
    const name = row.slice(0, separator);
    const value = row.slice(separator + 1);
    if (separator < 1 || !names.includes(name) || Object.hasOwn(values, name) || value.length === 0 || value.trim() !== value || unsupported.test(value)) {
      throw new Error("Invalid test environment value");
    }
    values[name] = value;
  }
  if (!names.every((name) => Object.hasOwn(values, name))) {
    throw new Error("Missing test environment value");
  }
  return values;
}

function launcherEnvironment(values) {
  const environment = Object.create(null);
  for (const name of ["PATH", "SystemRoot", "ComSpec", "TEMP", "USERPROFILE"]) {
    environment[name] = requireValue(name);
  }
  for (const name of ["WINDIR", "PATHEXT", "TMP", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "HOMEDRIVE", "HOMEPATH", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE", "SSL_CERT_DIR", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE", "NPM_CONFIG_CAFILE", "PIP_CERT"]) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) {
      environment[name] = value;
    }
  }
  environment.CI = "1";
  environment.NO_COLOR = "1";
  return { ...environment, ...values };
}

if (process.argv.length !== 4 || process.argv[2] !== "next" || process.argv[3] !== "build") {
  throw new Error("Expected literal arguments: next build");
}

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) {
  throw new Error("Next executable is unavailable");
}
const result = spawnSync(process.execPath, [nextBin, "build"], { cwd: process.cwd(), env: launcherEnvironment(parseFixture()), shell: false, stdio: "inherit" });
if (typeof result.status !== "number" || result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
