import { readFile } from "node:fs/promises"

const names = ["NODE_ENV", "DEMO_SEED_ENABLED", "DEMO_CITIZEN_PASSWORD", "DEMO_MODERATOR_PASSWORD", "DEMO_ADMIN_PASSWORD"] as const
const passwordNames = names.slice(2)

export type DemoSeedConfig = {
  NODE_ENV: "development" | "test"
  DEMO_SEED_ENABLED: true
  DEMO_CITIZEN_PASSWORD: string
  DEMO_MODERATOR_PASSWORD: string
  DEMO_ADMIN_PASSWORD: string
}

export type DemoSeedArgs = { manifestJson: boolean }

const invalid = (message: string): never => { throw new Error(message) }

const validatePassword = (name: string, value: unknown): string => {
  if (typeof value !== "string") return invalid(`${name} is required`)
  const scalarCount = Array.from(value).length
  if (scalarCount < 12 || scalarCount > 128 || Buffer.byteLength(value, "utf8") > 512 || value.length === 0) return invalid(`${name} is invalid`)
  return value
}

export const parseDemoSeedConfig = (source: Record<string, unknown>): DemoSeedConfig => {
  const environment = source.NODE_ENV
  if (environment !== "development" && environment !== "test") return invalid("NODE_ENV must be development or test")
  if (source.DEMO_SEED_ENABLED !== "true" && source.DEMO_SEED_ENABLED !== true) invalid("DEMO_SEED_ENABLED must be true")
  const values = passwordNames.map((name) => validatePassword(name, source[name]))
  if (new Set(values).size !== values.length) invalid("Demo passwords must differ")
  return {
    NODE_ENV: environment,
    DEMO_SEED_ENABLED: true,
    DEMO_CITIZEN_PASSWORD: values[0] ?? invalid("Missing citizen password"),
    DEMO_MODERATOR_PASSWORD: values[1] ?? invalid("Missing moderator password"),
    DEMO_ADMIN_PASSWORD: values[2] ?? invalid("Missing administrator password"),
  }
}

export const parseDemoSeedArgs = (args: readonly string[]): DemoSeedArgs => {
  if (args.length === 0) return { manifestJson: false }
  if (args.length === 1 && args[0] === "--manifest-json") return { manifestJson: true }
  return invalid("Unknown demo-seed argument")
}

export const loadDemoSeedConfig = (): DemoSeedConfig => {
  const source: Record<string, unknown> = {}
  for (const name of names) source[name] = process.env[name]
  return parseDemoSeedConfig(source)
}

export const loadDemoLocations = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, "utf8"))
