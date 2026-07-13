import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const names = ["FRONTEND_ENV", "NEXT_PUBLIC_API_BASE_URL", "INTERNAL_API_BASE_URL", "NEXT_PUBLIC_APP_ORIGIN", "NEXT_PUBLIC_MAP_STYLE_URL", "NEXT_PUBLIC_MAP_ATTRIBUTION", "NEXT_PUBLIC_MAP_CONNECT_ORIGINS", "NEXT_PUBLIC_MAP_IMAGE_ORIGINS", "NEXT_PUBLIC_DEFAULT_MAP_LATITUDE", "NEXT_PUBLIC_DEFAULT_MAP_LONGITUDE", "NEXT_PUBLIC_DEFAULT_MAP_ZOOM", "NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB"]

const parse = (source, requireFinalLf = true) => {
  const values = new Map()
  const lines = source.split("\n")
  if (requireFinalLf && !source.endsWith("\n")) throw new Error("environment file must end with LF")
  const contentLines = source.endsWith("\n") ? lines.slice(0, -1) : lines
  for (const sourceLine of contentLines) {
    const line = sourceLine.endsWith("\r") ? sourceLine.slice(0, -1) : sourceLine
    const separator = line.indexOf("=")
    const candidateName = separator > 0 ? line.slice(0, separator) : ""
    const candidateValue = separator > 0 ? line.slice(separator + 1) : ""
    if (line.length === 0 || !/^[A-Z0-9_]+$/u.test(candidateName) || /[#$\\"]/u.test(candidateValue)) throw new Error(`invalid environment grammar: ${line}`)
    const name = candidateName
    if (values.has(name)) throw new Error("duplicate environment name")
    values.set(name, line.slice(separator + 1))
  }
  return values
}

const main = async () => {
  const argument = process.argv[2]
  if (process.argv.length !== 4 || argument !== "--env-file") throw new Error("expected --env-file <path>")
  const requested = process.argv[3]
  if (requested === undefined) throw new Error("missing environment path")
  const file = requested === ".env" ? resolve(root, ".env") : isAbsolute(requested) ? requested : (() => { throw new Error("environment path must be absolute or .env") })()
  const values = parse(await readFile(file, "utf8"))
  for (const name of names) if (!values.has(name) || values.get(name) === "") throw new Error(`missing frontend value: ${name}`)
  const frontend = parse(await readFile(resolve(root, "frontend/.env.local"), "utf8"), false)
  for (const name of names) if (values.get(name) !== frontend.get(name)) throw new Error(`frontend value drift: ${name}`)
  if (values.get("DATABASE_URL") !== undefined) {
    const databaseUrl = new URL(values.get("DATABASE_URL"))
    if (databaseUrl.protocol !== "postgresql:" || databaseUrl.hostname !== "db" || databaseUrl.port !== "5432" || databaseUrl.search !== "" || databaseUrl.hash !== "") throw new Error("invalid database URL")
  }
  process.stdout.write("compose environment valid\n")
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "compose verification failed"}\n`); process.exitCode = 1 })
