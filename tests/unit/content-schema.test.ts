import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

type JsonObject = Record<string, unknown>;

const contentPath = path.resolve(process.cwd(), "content.json");

const readContent = (): JsonObject => {
  const raw = readFileSync(contentPath, "utf-8");
  return JSON.parse(raw) as JsonObject;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const assertNoEmptyStrings = (value: unknown): void => {
  if (typeof value === "string") {
    expect(value.trim().length).toBeGreaterThan(0);
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertNoEmptyStrings(entry);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as JsonObject)) {
      assertNoEmptyStrings(nestedValue);
    }
  }
};

describe("content.json schema", () => {
  test("has all required top-level keys", () => {
    const content = readContent();
    expect(content).toHaveProperty("meta");
    expect(content).toHaveProperty("hero");
    expect(content).toHaveProperty("services");
    expect(content).toHaveProperty("about");
    expect(content).toHaveProperty("contact");
  });

  test("has a services array with at least one item", () => {
    const content = readContent();
    expect(Array.isArray(content.services)).toBe(true);
    expect((content.services as unknown[]).length).toBeGreaterThanOrEqual(1);
  });

  test("ensures each service has required fields", () => {
    const content = readContent();
    const services = content.services as unknown[];

    for (const service of services) {
      expect(service).toHaveProperty("id");
      expect(service).toHaveProperty("title");
      expect(service).toHaveProperty("description");
      expect(service).toHaveProperty("icon");
      expect(isNonEmptyString((service as JsonObject).id)).toBe(true);
      expect(isNonEmptyString((service as JsonObject).title)).toBe(true);
      expect(isNonEmptyString((service as JsonObject).description)).toBe(true);
      expect(isNonEmptyString((service as JsonObject).icon)).toBe(true);
    }
  });

  test("validates meta.email format", () => {
    const content = readContent();
    const meta = content.meta as JsonObject;
    const email = meta.email;

    expect(isNonEmptyString(email)).toBe(true);
    expect(String(email)).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test("ensures all string values are non-empty", () => {
    const content = readContent();
    assertNoEmptyStrings(content);
  });
});