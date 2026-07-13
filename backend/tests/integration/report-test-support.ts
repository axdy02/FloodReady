import type { Response } from "supertest"
import { expect } from "vitest"
import { createTestUser, type TestUser } from "../helpers/database.js"
import { api } from "../helpers/http.js"
import { jpegImage } from "../fixtures/images.js"

export interface AuthenticatedUser {
  accessToken: string
  user: TestUser
}

export interface ReportFields {
  capturedAt: string
  category: string
  description: string
  gpsAccuracy: string
  latitude: string
  longitude: string
  severityClaim: string
}

export const bearer = (accessToken: string): string => `Bearer ${accessToken}`

export const signInTestUser = async (
  role: TestUser["role"] = "USER",
): Promise<AuthenticatedUser> => {
  const user = await createTestUser(role)
  const response = await api()
    .post("/api/v1/auth/login")
    .set("Content-Type", "application/json")
    .send({ email: user.email, password: user.password })
  expect(response.status).toBe(200)
  const accessToken: unknown = response.body.data?.accessToken
  if (typeof accessToken !== "string") {
    throw new Error("Expected an access token from the test login")
  }
  return { accessToken, user }
}

export const reportFields = (overrides: Partial<ReportFields> = {}): ReportFields => ({
  capturedAt: overrides.capturedAt ?? new Date(Date.now() - 60_000).toISOString(),
  category: overrides.category ?? "FLOODED_ROAD",
  description: overrides.description ?? "Water is blocking one lane.",
  gpsAccuracy: overrides.gpsAccuracy ?? "4.5",
  latitude: overrides.latitude ?? "12.971600",
  longitude: overrides.longitude ?? "77.594600",
  severityClaim: overrides.severityClaim ?? "MODERATE",
})

export const submitReport = async (
  accessToken: string,
  overrides: Partial<ReportFields> = {},
  image: Buffer | undefined = undefined,
  mime = "image/jpeg",
): Promise<Response> => {
  const fields = reportFields(overrides)
  const bytes = image ?? await jpegImage()
  return api()
    .post("/api/v1/reports")
    .set("Authorization", bearer(accessToken))
    .field("category", fields.category)
    .field("latitude", fields.latitude)
    .field("longitude", fields.longitude)
    .field("gpsAccuracy", fields.gpsAccuracy)
    .field("capturedAt", fields.capturedAt)
    .field("description", fields.description)
    .field("severityClaim", fields.severityClaim)
    .attach("image", bytes, { contentType: mime, filename: "untrusted-client-name.jpg" })
}

export const responseId = (response: Response): string => {
  const id: unknown = response.body.data?.id
  if (typeof id !== "string") {
    throw new Error("Expected a response resource ID")
  }
  return id
}
