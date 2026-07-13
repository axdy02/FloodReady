import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/providers/app-providers";
import { createQueryClient } from "@/lib/query/client";

describe("application providers", () => {
  it("mounts a single query client provider", () => {
    render(<AppProviders><main>Foundation</main></AppProviders>);
    expect(screen.getByText("Foundation")).toBeInTheDocument();
  });

  it("uses the specified incremental query delay", () => {
    const delay = createQueryClient().getDefaultOptions().queries?.retryDelay;
    expect(typeof delay).toBe("function");
    expect((delay as (attempt: number) => number)(2)).toBe(2000);
  });
});
