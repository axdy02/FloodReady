import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtectedShell } from "@/components/app-shell/protected-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/reports" }));

describe("wireframe navigation", () => {
  it("keeps only the four working report-flow destinations in the main navigation", () => {
    render(<ProtectedShell><p>Gallery content</p></ProtectedShell>);
    const link = screen.getByRole("link", { name: "Reports" });
    expect(link).toHaveAttribute("href", "/reports");
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Map" })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: "Submit a Report" })).toHaveAttribute("href", "/reports/new");
  });
});
