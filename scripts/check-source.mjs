import { access, readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const files = ["docker-compose.yml", "docker-compose.dev.yml", ".env.example", ".gitignore", "backend/Dockerfile", "frontend/Dockerfile", "ai-service/Dockerfile", "scripts/acceptance.mjs", "scripts/verify-compose.mjs", "scripts/milestone2-preflight.mjs"]
const forbidden = ["con" + "sole.", "shell: true", "TO" + "DO", "re" + "place_", "password=example"]

const main = async () => {
  for (const relative of files) {
    const path = resolve(root, relative)
    await access(path)
    const source = await readFile(path, "utf8")
    if (source.charCodeAt(0) === 0xfeff || !source.endsWith("\n")) throw new Error(`${relative}: invalid encoding`) 
    for (const term of forbidden) if (source.includes(term)) throw new Error(`${relative}: forbidden source`) 
  }
  process.stdout.write(`${files.length} root files scanned, 0 violations\n`)
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : "source check failed"}\n`); process.exitCode = 1 })
