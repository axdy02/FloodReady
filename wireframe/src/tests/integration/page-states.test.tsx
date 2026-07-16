import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Loading from "@/app/loading";
import NotFoundPage from "@/app/not-found";
import ErrorPage from "@/app/error";
import { SafetyNotice } from "@/features/map/safety-notice";

describe("foundation page states", () => {
  it("renders an accessible loading landmark without application data", () => {
    render(<Loading />);
    expect(screen.getByRole("main", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });

  it("states the public evidence and safety boundaries", () => {
    render(<SafetyNotice />);
    expect(screen.getByRole("heading", { name: "Submitted evidence is unverified" })).toBeInTheDocument();
    expect(screen.getByText(/does not mean an area is safe/i)).toBeInTheDocument();
  });

  it("provides factual error and not-found states", () => {
    render(<><ErrorPage error={new Error("failure")} reset={() => undefined} /><NotFoundPage /></>);
    expect(screen.getByRole("heading", { name: "Unable to load this view" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
