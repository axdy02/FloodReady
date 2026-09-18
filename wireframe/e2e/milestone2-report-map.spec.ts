import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";

const evidencePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function expectWhiteForeground(control: Locator, label: string) {
  await expect(control, `${label} should be visible`).toBeVisible();
  const colors = await control.evaluate((element) => {
    const whiteReference = document.createElement("span");
    whiteReference.className = "text-white";
    whiteReference.setAttribute("aria-hidden", "true");
    document.body.append(whiteReference);

    const foreground = getComputedStyle(element).color;
    const background = getComputedStyle(element).backgroundColor;
    const expectedWhite = getComputedStyle(whiteReference).color;
    const icon = element.querySelector("svg");
    const iconForeground = icon === null ? null : getComputedStyle(icon).color;
    whiteReference.remove();

    return { foreground, background, expectedWhite, iconForeground };
  });

  expect(colors.foreground, `${label} should use the white foreground token`).toBe(colors.expectedWhite);
  expect(colors.foreground, `${label} foreground must differ from its background`).not.toBe(colors.background);
  if (colors.iconForeground !== null) {
    expect(colors.iconForeground, `${label} icon should inherit the readable foreground`).toBe(colors.foreground);
  }
}

test("creates a persisted report and reads its photo back through history and the map", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route("https://tiles.openfreemap.org/styles/liberty", (route) => route.fulfill({
    path: resolve("e2e/fixtures/blank-map-style.json"),
    contentType: "application/json",
  }));

  const identity = randomUUID();
  const email = `m2-browser-${identity}@example.com`;
  const password = `M2-${identity}!Aa1`;
  const description = `Browser acceptance report ${identity}: water covers both lanes.`;

  await page.goto("/reports/new");
  await expectWhiteForeground(page.locator("main").getByRole("link", { name: "Sign in" }), "anonymous sign-in action");
  await page.getByRole("link", { name: "Create account" }).click();
  await expectWhiteForeground(page.getByRole("button", { name: "Create account" }), "registration submit action");
  await page.getByLabel("Name").fill("Milestone 2 Browser Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/login\?.*returnTo=%2Freports%2Fnew/u);
  await expectWhiteForeground(page.locator("header").getByRole("link", { name: "Create account" }), "public-header account action");
  await expectWhiteForeground(page.getByRole("button", { name: "Sign in" }), "login submit action");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/reports\/new$/u);
  await expectWhiteForeground(page.getByRole("navigation", { name: "Milestone 2 navigation" }).getByRole("link", { name: "Submit Flood Report" }), "active report navigation action");
  await expectWhiteForeground(page.getByRole("button", { name: "Analyze with AI" }), "report analysis action");
  expect(browserErrors.every((message) => message.includes("401 (Unauthorized)"))).toBe(true);
  browserErrors.length = 0;

  await page.getByLabel("Description").fill(description);
  await page.locator('input[type="file"]').setInputFiles({ name: "milestone2.png", mimeType: "image/png", buffer: evidencePng });
  const map = page.getByLabel("FloodReady map");
  const formCanvas = map.locator(".maplibregl-canvas");
  await expect(formCanvas).toBeVisible();
  await expect(async () => {
    const bounds = await formCanvas.boundingBox();
    if (bounds === null) throw new Error("Expected the report-form map canvas");
    await formCanvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.getByText("map selection", { exact: true })).toBeVisible();
  }).toPass();

  await page.getByRole("button", { name: "Analyze with AI" }).click();
  await expect(page.getByRole("heading", { name: /AI unavailable/u })).toBeVisible();
  await page.getByRole("button", { name: "Continue without AI" }).click();
  await page.getByRole("button", { name: "Submit final report" }).click();
  await expect(page.getByRole("heading", { name: "Flood report created" })).toBeVisible();
  const mapHref = await page.getByRole("link", { name: "Show persisted marker on map" }).getAttribute("href");
  const reportId = new URL(mapHref ?? "", "http://localhost").searchParams.get("report");
  expect(reportId).toMatch(/^[0-9a-f-]{36}$/u);

  const reportHistoryLink = page.getByRole("link", { name: "View submitted reports" });
  await expectWhiteForeground(reportHistoryLink, "submitted-report history action");
  await reportHistoryLink.click();
  await expect(page).toHaveURL(/\/reports$/u);
  await expect(page.getByRole("heading", { name: "Submitted Reports" })).toBeVisible();
  await expectWhiteForeground(page.getByRole("navigation", { name: "Milestone 2 navigation" }).getByRole("link", { name: "My Reports" }), "active report-history navigation action");
  await expectWhiteForeground(page.getByRole("main").getByRole("link", { name: "Submit Flood Report" }), "report-history submit action");

  const submittedReport = page.getByRole("article").filter({ hasText: description });
  await expect(submittedReport).toBeVisible();
  const evidenceImage = submittedReport.getByRole("img", { name: /Evidence for Flooded road report/u });
  await expect(evidenceImage).toHaveAttribute("src", /^blob:/u);
  await expect.poll(() => evidenceImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const accessibility = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.reload();
  const persistedReport = page.getByRole("article").filter({ hasText: description });
  await expect(persistedReport).toBeVisible();
  const persistedImage = persistedReport.getByRole("img", { name: /Evidence for Flooded road report/u });
  await expect.poll(() => persistedImage.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await persistedReport.getByRole("link", { name: "Show on map" }).click();
  await expect(page).toHaveURL(new RegExp(`/map\\?report=${reportId ?? "missing"}`));
  await expectWhiteForeground(page.getByRole("navigation", { name: "Milestone 2 navigation" }).getByRole("link", { name: "Reports Map" }), "active map navigation action");
  await expectWhiteForeground(page.getByRole("main").getByRole("link", { name: "Submit Flood Report" }), "map report action");
  const markerDetails = page.getByLabel("Report marker details");
  await expect(markerDetails).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  await expect(page.getByText("Moderate", { exact: true })).toBeVisible();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Close report details" }).click();
  await expect(markerDetails).toBeHidden();
  const resultsCanvas = page.getByLabel("FloodReady map").locator(".maplibregl-canvas");
  await expect(async () => {
    const bounds = await resultsCanvas.boundingBox();
    if (bounds === null) throw new Error("Expected the reports-map canvas");
    await resultsCanvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(markerDetails).toBeVisible();
  }).toPass();
  await expect(page.locator(".maplibregl-popup-content")).toContainText("FLOODED ROAD");

  await page.reload();
  await expect(markerDetails).toBeVisible();
  await expect(page.getByText(description)).toBeVisible();
  expect(browserErrors).toEqual([]);
});
