export const validUser = { id: "10000000-0000-4000-8000-000000000001", name: "Test User", email: "test@example.invalid", role: "USER", isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } as const;
export const validAuth = { accessToken: "access-token", tokenType: "Bearer", expiresInSeconds: 900, user: validUser } as const;
