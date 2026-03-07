import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const readUtf8 = (relativePath: string): string =>
  readFileSync(path.resolve(root, relativePath), "utf-8");

describe("assignment acceptance criteria", () => {
  test("content.json exists and is valid JSON", () => {
    const contentPath = path.resolve(root, "content.json");
    expect(existsSync(contentPath)).toBe(true);
    expect(() => JSON.parse(readUtf8("content.json"))).not.toThrow();
  });

  test("content.json has all required sections", () => {
    const content = JSON.parse(readUtf8("content.json")) as Record<string, unknown>;
    expect(content).toHaveProperty("meta");
    expect(content).toHaveProperty("hero");
    expect(content).toHaveProperty("services");
    expect(content).toHaveProperty("about");
    expect(content).toHaveProperty("contact");
  });

  test("docs/index.html exists", () => {
    expect(existsSync(path.resolve(root, "docs", "index.html"))).toBe(true);
  });

  test("docs/index.html contains consultant name", () => {
    const html = readUtf8("docs/index.html");
    const content = JSON.parse(readUtf8("content.json")) as {
      meta: { name: string };
    };
    expect(html).toContain(content.meta.name);
  });

  test("docs/index.html contains at least 3 service titles", () => {
    const html = readFileSync(path.resolve(root, "docs", "index.html"), "utf-8");
    const content = JSON.parse(readFileSync(path.resolve(root, "content.json"), "utf-8"));
    const matchedCount = content.services
      .map((s: { title: string }) => s.title)
      .filter((title: string) => html.includes(title)).length;
    expect(matchedCount).toBeGreaterThanOrEqual(3);
  });

  test("docs/.nojekyll exists", () => {
    expect(existsSync(path.resolve(root, "docs", ".nojekyll"))).toBe(true);
  });

  test("deploy workflow exists", () => {
    expect(existsSync(path.resolve(root, ".github", "workflows", "deploy.yml"))).toBe(true);
  });

  test("README exists and mentions GitHub Pages", () => {
    expect(existsSync(path.resolve(root, "README.md"))).toBe(true);
    expect(readUtf8("README.md")).toContain("GitHub Pages");
  });

  test("recorder-app/package.json exists", () => {
    expect(existsSync(path.resolve(root, "recorder-app", "package.json"))).toBe(true);
  });
});