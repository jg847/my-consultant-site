import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

type Workflow = {
  on?: {
    push?: {
      branches?: string[];
      paths?: string[];
    };
  };
  jobs?: Record<string, { steps?: Array<Record<string, unknown>> }>;
};

const workflowPath = path.resolve(process.cwd(), ".github", "workflows", "deploy.yml");

const readWorkflow = (): Workflow => {
  const content = readFileSync(workflowPath, "utf-8");
  return yaml.load(content, { schema: yaml.JSON_SCHEMA }) as Workflow;
};

describe("deploy workflow", () => {
  test("workflow file exists", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  test("has an 'on' trigger", () => {
    const workflow = readWorkflow();
    expect(workflow.on).toBeDefined();
  });

  test("includes push trigger to main", () => {
    const workflow = readWorkflow();
    expect(workflow.on?.push?.branches).toContain("main");
  });

  test("includes content.json path filter", () => {
    const workflow = readWorkflow();
    expect(workflow.on?.push?.paths).toContain("content.json");
  });

  test("has at least one job", () => {
    const workflow = readWorkflow();
    expect(workflow.jobs).toBeDefined();
    expect(Object.keys(workflow.jobs ?? {}).length).toBeGreaterThan(0);
  });

  test("includes at least one step with node or npm", () => {
    const workflow = readWorkflow();
    const jobs = Object.values(workflow.jobs ?? {});
    const hasNodeOrNpmStep = jobs.some((job) =>
      (job.steps ?? []).some((step) => {
        const uses = typeof step.uses === "string" ? step.uses.toLowerCase() : "";
        const run = typeof step.run === "string" ? step.run.toLowerCase() : "";
        return uses.includes("actions/setup-node") || run.includes("npm");
      })
    );

    expect(hasNodeOrNpmStep).toBe(true);
  });
});