import { describe, expect, it } from "vitest";
import { profileSchema } from "@/features/users/schemas";
import { authStore } from "@/features/auth/auth-store";
import { validUser } from "@/tests/fixtures/contracts";

describe("profile contract", () => {
  it("accepts only a normalized name and preserves role/email read-only data", () => {
    expect(profileSchema.parse({ name: "  Profile  User " }).name).toBe("Profile User");
    expect(() => profileSchema.parse({ name: "A", role: "ADMIN" })).toThrow();
    authStore.setSession("token", validUser, 900);
    authStore.updateUser({ ...validUser, name: "Updated User" });
    const state = authStore.getState();
    expect(state.kind === "AUTHENTICATED" && state.user.email).toBe(validUser.email);
  });
});
