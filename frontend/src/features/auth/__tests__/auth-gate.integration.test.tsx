import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/features/auth/auth-gate";
import type { AuthState } from "@/features/auth/types";

const mocked = vi.hoisted(() => ({ pathname: "/map", query: "lat=28.61398&lng=77.20902", state: { kind: "ANONYMOUS" } as AuthState }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocked.pathname,
  useSearchParams: () => new URLSearchParams(mocked.query),
}));

vi.mock("@/features/auth/auth-context", () => ({ useAuth: () => mocked.state }));

describe("AuthGate", () => {
  it("keeps the map private for anonymous visitors and preserves the requested map URL", () => {
    mocked.state = { kind: "ANONYMOUS" };
    render(<AuthGate><p>Private map content</p></AuthGate>);

    expect(screen.queryByText("Private map content")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?returnTo=%2Fmap%3Flat%3D28.61398%26lng%3D77.20902");
  });

  it("renders private map content after authentication", () => {
    mocked.state = { kind: "AUTHENTICATED", accessToken: "test-token", expiresAt: Date.now() + 60_000, user: { id: "00000000-0000-4000-8000-000000000001", name: "Test User", email: "test@example.com", role: "USER", isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" } };
    render(<AuthGate><p>Private map content</p></AuthGate>);

    expect(screen.getByText("Private map content")).toBeInTheDocument();
  });
});
