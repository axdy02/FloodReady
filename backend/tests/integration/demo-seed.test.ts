import { describe, expect, it } from "vitest"
import { parseDemoSeedArgs, parseDemoSeedConfig } from "../../prisma/demo-seed-config.js"

const passwords = {
  NODE_ENV: "test",
  DEMO_SEED_ENABLED: "true",
  DEMO_CITIZEN_PASSWORD: "citizen-demo-password",
  DEMO_MODERATOR_PASSWORD: "moderator-demo-password",
  DEMO_ADMIN_PASSWORD: "administrator-demo-password",
}

describe("demo seed configuration", () => {
  it("accepts explicit test configuration and the manifest flag", () => {
    expect(parseDemoSeedConfig(passwords)).toMatchObject({ NODE_ENV: "test", DEMO_SEED_ENABLED: true })
    expect(parseDemoSeedArgs(["--manifest-json"])).toEqual({ manifestJson: true })
  })

  it("rejects production, missing passwords, duplicate passwords, and unknown arguments", () => {
    expect(() => parseDemoSeedConfig({ ...passwords, NODE_ENV: "production" })).toThrow()
    expect(() => parseDemoSeedConfig({ ...passwords, DEMO_ADMIN_PASSWORD: undefined })).toThrow()
    expect(() => parseDemoSeedConfig({ ...passwords, DEMO_ADMIN_PASSWORD: passwords.DEMO_CITIZEN_PASSWORD })).toThrow()
    expect(() => parseDemoSeedArgs(["--unexpected"])).toThrow()
  })
})
