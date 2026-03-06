import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function MockAnthropic() {
    return {
      messages: {
        create: mockCreate
      }
    };
  })
}));

import * as cleanRoute from "../../recorder-app/app/api/clean/route";

const createJsonRequest = (body: Record<string, unknown>, method = "POST") =>
  new Request("http://localhost/api/clean", {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

describe("clean route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    cleanRoute.cleanDeps.createAnthropicClient = vi.fn().mockReturnValue({
      messages: {
        create: mockCreate
      }
    } as never);
    mockCreate.mockReset();
  });

  test("returns 400 if transcript is missing", async () => {
    const request = createJsonRequest({ section: "hero" });
    const response = await cleanRoute.handleClean(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Transcript is required" });
  });

  test("returns 400 if section is missing", async () => {
    const request = createJsonRequest({ transcript: "messy transcript" });
    const response = await cleanRoute.handleClean(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Section is required" });
  });

  test("returns 400 for invalid section", async () => {
    const request = createJsonRequest({ transcript: "messy transcript", section: "pricing" });
    const response = await cleanRoute.handleClean(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid section. Must be one of: meta, hero, services, about, contact"
    });
  });

  test("returns cleaned object matching section schema", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            headline: "Transform Your Business with AI",
            subheadline: "Practical AI guidance",
            cta_text: "Get in Touch",
            cta_href: "#contact"
          })
        }
      ]
    });

    const request = createJsonRequest({
      transcript: "uh transform your business with ai and get in touch",
      section: "hero"
    });

    const response = await cleanRoute.handleClean(request);
    const body = (await response.json()) as { cleaned: Record<string, string> };

    expect(response.status).toBe(200);
    expect(body.cleaned).toHaveProperty("headline");
    expect(body.cleaned).toHaveProperty("subheadline");
    expect(body.cleaned).toHaveProperty("cta_text");
    expect(body.cleaned).toHaveProperty("cta_href");
  });

  test("parses and returns valid JSON from Claude", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"prompt":"Ready to start?","form_action":"https://formspree.io/f/test"}' }]
    });

    const request = createJsonRequest({
      transcript: "ready to start",
      section: "contact"
    });

    const response = await cleanRoute.handleClean(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      cleaned: {
        prompt: "Ready to start?",
        form_action: "https://formspree.io/f/test"
      }
    });
  });

  test("returns 500 when Claude returns malformed JSON", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not valid json" }]
    });

    const request = createJsonRequest({ transcript: "messy", section: "meta" });
    const response = await cleanRoute.handleClean(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to parse AI response" });
  });

  test("returns 500 with sanitized error when Anthropic throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Anthropic upstream stacktrace details"));

    const request = createJsonRequest({ transcript: "messy", section: "about" });
    const response = await cleanRoute.handleClean(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Cleaning service unavailable" });
    expect(body.error).not.toContain("stacktrace");
  });

  test("request to Claude includes system prompt with consultant", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            prompt: "Ready to start?",
            form_action: "https://formspree.io/f/test"
          })
        }
      ]
    });

    const request = createJsonRequest({ transcript: "messy", section: "contact" });
    await cleanRoute.handleClean(request);

    const calledWith = mockCreate.mock.calls[0]?.[0] as {
      system?: string;
      messages?: Array<{ content: string }>;
    };
    expect(calledWith.system?.toLowerCase()).toContain("consultant");
  });

  test("request to Claude includes transcript in user message", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            prompt: "Ready to start?",
            form_action: "https://formspree.io/f/test"
          })
        }
      ]
    });

    const transcript = "um i help teams adopt ai workflows";
    const request = createJsonRequest({ transcript, section: "contact" });
    await cleanRoute.handleClean(request);

    const calledWith = mockCreate.mock.calls[0]?.[0] as {
      messages?: Array<{ content: string }>;
    };
    expect(calledWith.messages?.[0]?.content).toContain(transcript);
  });
});