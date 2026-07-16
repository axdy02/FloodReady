import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

type Scanner = { scanPaths(paths: string[]): Array<{ rule: string }> };

describe("source policy", () => {
  it("identifies the fixture violation", async () => {
    const fixture = path.resolve(import.meta.dirname, "../fixtures/source-policy/violations.txt");
    const module = await import(pathToFileURL(path.resolve(import.meta.dirname, "../../../scripts/check-source.mjs")).href) as unknown as Scanner;
    expect(module.scanPaths([fixture]).map((finding) => finding.rule)).toContain("unfinished-marker");
  });
});
