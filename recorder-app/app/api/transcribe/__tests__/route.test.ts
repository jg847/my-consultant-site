import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      audio: {
        transcriptions: {
          create: mockCreate
        }
      }
    };
  })
}));

import * as transcribeRoute from "../route";

const createMultipartRequest = (file?: File, method = "POST") => {
  const form = new FormData();
  if (file) {
    form.set("audio", file);
  }

  if (method === "GET") {
    return new Request("http://localhost/api/transcribe", {
      method
    });
  }

  return new Request("http://localhost/api/transcribe", {
    method,
    body: form
  });
};

describe("transcribe route (co-located)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.OPENAI_API_KEY = "test-api-key";
    transcribeRoute.routeDeps.createOpenAIClient = vi.fn().mockReturnValue({
      audio: {
        transcriptions: {
          create: mockCreate
        }
      }
    } as never);
  });

  test("returns 405 if method is not POST", async () => {
    const request = createMultipartRequest(undefined, "GET");
    const response = await transcribeRoute.handleTranscribe(request, "GET");
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: "Method not allowed" });
  });

  test("returns 400 if no audio file in request body", async () => {
    const request = createMultipartRequest();
    const response = await transcribeRoute.handleTranscribe(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Audio file is required" });
  });

  test("returns 400 if file is empty", async () => {
    const emptyFile = new File([], "recording.webm", { type: "audio/webm" });
    const request = createMultipartRequest(emptyFile);
    const response = await transcribeRoute.handleTranscribe(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Audio file is empty" });
  });

  test("returns transcript when OpenAI responds", async () => {
    mockCreate.mockResolvedValueOnce({ text: "Hello world" });
    const file = new File([new Uint8Array([1, 2, 3])], "recording.webm", {
      type: "audio/webm"
    });
    const request = createMultipartRequest(file);

    const response = await transcribeRoute.handleTranscribe(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ transcript: "Hello world" });
  });

  test("returns sanitized 500 when OpenAI throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("OpenAI internal error: key=abc"));
    const file = new File([new Uint8Array([1])], "recording.webm", { type: "audio/webm" });
    const request = createMultipartRequest(file);

    const response = await transcribeRoute.handleTranscribe(request);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Transcription service unavailable" });
  });

  test("does not return actual OpenAI error message", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Sensitive OpenAI response details"));
    const file = new File([new Uint8Array([1])], "recording.webm", { type: "audio/webm" });
    const request = createMultipartRequest(file);

    const response = await transcribeRoute.handleTranscribe(request);
    const body = await response.json();
    expect(body.error).not.toContain("Sensitive OpenAI response details");
    expect(body).toEqual({ error: "Transcription service unavailable" });
  });

  test("returns 500 with missing API key error when OPENAI_API_KEY is undefined", async () => {
    delete process.env.OPENAI_API_KEY;
    const file = new File([new Uint8Array([1])], "recording.webm", { type: "audio/webm" });
    const request = createMultipartRequest(file);

    const response = await transcribeRoute.handleTranscribe(request);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Missing API key" });
  });
});