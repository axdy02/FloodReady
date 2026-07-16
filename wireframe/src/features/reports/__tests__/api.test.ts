import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/api/request", () => ({ request: mocks.request }));

import { reportsApi } from "@/features/reports/api";

describe("reports API adapter", () => {
  it("routes create, detail, history, and private images through the shared boundary", () => {
    const form = new FormData();
    const controller = new AbortController();

    void reportsApi.create(form, "token");
    void reportsApi.detail("report-id", "token");
    void reportsApi.own("limit=12&sort=desc", "token");
    void reportsApi.image("report-id", "token");
    void reportsApi.image("report-id", "token", controller.signal);

    expect(mocks.request).toHaveBeenCalledTimes(5);
    expect(mocks.request).toHaveBeenNthCalledWith(1, expect.objectContaining({ method: "POST", path: "/reports", body: form, accessToken: "token", timeoutClass: "imageUpload" }));
    expect(mocks.request).toHaveBeenNthCalledWith(2, expect.objectContaining({ method: "GET", path: "/reports/report-id", accessToken: "token" }));
    expect(mocks.request).toHaveBeenNthCalledWith(3, expect.objectContaining({ method: "GET", path: "/users/me/reports?limit=12&sort=desc", accessToken: "token" }));
    expect(mocks.request).toHaveBeenNthCalledWith(4, expect.not.objectContaining({ signal: expect.anything() }));
    expect(mocks.request).toHaveBeenNthCalledWith(5, expect.objectContaining({ method: "GET", path: "/reports/report-id/image", accessToken: "token", responseMode: "protectedReportImage", signal: controller.signal }));
  });
});
