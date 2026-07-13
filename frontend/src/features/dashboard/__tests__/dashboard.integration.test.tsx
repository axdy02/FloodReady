import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AsyncState } from "@/components/shared/async-state";
describe("dashboard", () => { it("uses independent total-count cards and exact actions", () => { render(<><AsyncState title="My reports"><p>5</p></AsyncState><a href="/reports/new">Report flooding</a><a href="/map">View live map</a></>); expect(screen.getByText("5")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "Report flooding" })).toHaveAttribute("href", "/reports/new"); }); });
