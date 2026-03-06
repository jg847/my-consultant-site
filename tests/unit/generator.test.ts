import { describe, expect, test } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";

const generatorPath = path.resolve(process.cwd(), "site-generator", "generate.js");
const { renderTemplate, generateSite } = require(generatorPath) as {
  renderTemplate: (template: string, data: Record<string, unknown>) => string;
  generateSite: (contentPath: string, outputPath: string) => void;
};

describe("generator", () => {
  test("renderTemplate replaces {{key}} placeholders", () => {
    const template = "Hello {{name}}";
    const result = renderTemplate(template, { name: "Jane" });
    expect(result).toBe("Hello Jane");
  });

  test("renderTemplate replaces nested keys like {{meta.name}}", () => {
    const template = "Consultant: {{meta.name}}";
    const result = renderTemplate(template, { meta: { name: "Jane Smith" } });
    expect(result).toBe("Consultant: Jane Smith");
  });

  test("renderTemplate renders services array as list items", () => {
    const template = "<ul>{{services}}</ul>";
    const result = renderTemplate(template, {
      services: [
        { id: "training", title: "AI Training", description: "Workshops", icon: "🎓" },
        { id: "strategy", title: "Strategic Advisory", description: "Roadmaps", icon: "🧭" }
      ]
    });

    expect(result).toContain("<li");
    expect(result).toContain("AI Training");
    expect(result).toContain("Strategic Advisory");
  });

  test("generateSite reads JSON and writes output HTML file", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
    const outputPath = path.join(tempDir, "docs", "index.html");

    try {
      generateSite(path.resolve(process.cwd(), "content.json"), outputPath);
      expect(existsSync(outputPath)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("generateSite throws clear error when content file is missing", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
    const missingPath = path.join(tempDir, "missing-content.json");
    const outputPath = path.join(tempDir, "docs", "index.html");

    try {
      expect(() => generateSite(missingPath, outputPath)).toThrowError(
        /Content file not found/
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("generateSite throws clear error when required field is missing", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
    const contentPath = path.join(tempDir, "content.json");
    const outputPath = path.join(tempDir, "docs", "index.html");

    writeFileSync(
      contentPath,
      JSON.stringify(
        {
          meta: {
            title: "AI Strategy Consultant",
            tagline: "Helping businesses navigate the AI transition",
            email: "jane@example.com",
            linkedin: "https://linkedin.com/in/janesmith"
          },
          hero: {
            headline: "Transform Your Business with AI",
            subheadline: "Strategic guidance",
            cta_text: "Get in Touch",
            cta_href: "#contact"
          },
          services: [
            {
              id: "training",
              title: "AI Training",
              description: "Hands-on workshops",
              icon: "🎓"
            }
          ],
          about: {
            bio: "Bio",
            highlights: ["Highlight"]
          },
          contact: {
            prompt: "Ready?",
            form_action: "https://formspree.io/f/YOUR_FORM_ID"
          }
        },
        null,
        2
      )
    );

    try {
      expect(() => generateSite(contentPath, outputPath)).toThrowError(
        /Missing required field: meta\.name/
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("output HTML contains consultant name from content.json", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
    const outputPath = path.join(tempDir, "docs", "index.html");

    try {
      generateSite(path.resolve(process.cwd(), "content.json"), outputPath);
      const html = readFileSync(outputPath, "utf-8");
      expect(html).toContain("Jane Smith");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("output HTML contains all three service titles", () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "generator-test-"));
    const outputPath = path.join(tempDir, "docs", "index.html");

    try {
      generateSite(path.resolve(process.cwd(), "content.json"), outputPath);
      const html = readFileSync(outputPath, "utf-8");
      expect(html).toContain("AI Training");
      expect(html).toContain("Strategic Advisory");
      expect(html).toContain("Development Support");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});