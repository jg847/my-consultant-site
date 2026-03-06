import { beforeEach, describe, expect, test, vi } from "vitest";
import * as publishRoute from "../../recorder-app/app/api/publish/route";

type FetchResponseShape = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const jsonRequest = (body: Record<string, unknown>, method = "POST") =>
  new Request("http://localhost/api/publish", {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

const b64 = (value: string) => Buffer.from(value, "utf-8").toString("base64");

describe("publish route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.GITHUB_TOKEN = "ghp_test_token_123";
    process.env.GITHUB_OWNER = "owner-test";
    process.env.GITHUB_REPO = "repo-test";
    process.env.GITHUB_BRANCH = "main";
  });

  test("returns 400 if section is missing", async () => {
    const response = await publishRoute.handlePublish(
      jsonRequest({ data: { bio: "Updated" } })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Section is required" });
  });

  test("returns 400 if data is missing", async () => {
    const response = await publishRoute.handlePublish(jsonRequest({ section: "about" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Data is required" });
  });

  test("returns 400 if section is invalid", async () => {
    const response = await publishRoute.handlePublish(
      jsonRequest({ section: "pricing", data: { title: "X" } })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid section. Must be one of: meta, hero, services, about, contact"
    });
  });

  test("fetches current content.json from GitHub before committing", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: b64('{"about":{"bio":"Old"}}'), sha: "abc123" })
    } as FetchResponseShape as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ commit: { html_url: "https://github.com/commit/1" } })
    } as FetchResponseShape as Response);

    await publishRoute.handlePublish(
      jsonRequest({ section: "about", data: { bio: "New" } })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/contents/content.json");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  test("merges new section data into existing content", async () => {
    const existing = {
      about: {
        bio: "Existing bio",
        highlights: ["Item 1"]
      }
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: b64(JSON.stringify(existing)), sha: "abc123" })
    } as FetchResponseShape as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ commit: { html_url: "https://github.com/commit/2" } })
    } as FetchResponseShape as Response);

    await publishRoute.handlePublish(
      jsonRequest({ section: "about", data: { bio: "Updated bio" } })
    );

    const putBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      content: string;
    };
    const decoded = Buffer.from(putBody.content, "base64").toString("utf-8");
    const updated = JSON.parse(decoded) as { about: { bio: string; highlights: string[] } };

    expect(updated.about.bio).toBe("Updated bio");
    expect(updated.about.highlights).toEqual(["Item 1"]);
  });

  test("does not commit when content is identical after merge", async () => {
    const current = {
      about: {
        bio: "Same bio"
      }
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: b64(JSON.stringify(current, null, 2)), sha: "abc123" })
    } as FetchResponseShape as Response);

    const response = await publishRoute.handlePublish(
      jsonRequest({ section: "about", data: { bio: "Same bio" } })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: "No changes detected" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("commits with message containing section name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: b64('{"about":{"bio":"Old"}}'), sha: "abc123" })
    } as FetchResponseShape as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ commit: { html_url: "https://github.com/commit/3" } })
    } as FetchResponseShape as Response);

    await publishRoute.handlePublish(
      jsonRequest({ section: "about", data: { bio: "Updated" } })
    );

    const putBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { message: string };
    expect(putBody.message.toLowerCase()).toContain("about");
  });

  test("returns success payload with commitUrl on success", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: b64('{"hero":{"headline":"Old"}}'), sha: "sha123" })
    } as FetchResponseShape as Response);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ commit: { html_url: "https://github.com/commit/ok" } })
    } as FetchResponseShape as Response);

    const response = await publishRoute.handlePublish(
      jsonRequest({ section: "hero", data: { headline: "New" } })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      commitUrl: "https://github.com/commit/ok"
    });
  });

  test("returns 500 with sanitized error when GitHub API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: "Internal error with token ghp_test_token_123" })
    } as FetchResponseShape as Response);

    const response = await publishRoute.handlePublish(
      jsonRequest({ section: "hero", data: { headline: "New" } })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "GitHub publish failed" });
    expect(JSON.stringify(body)).not.toContain("ghp_test_token_123");
  });

  test("never includes GITHUB_TOKEN in response body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" })
    } as FetchResponseShape as Response);

    const response = await publishRoute.handlePublish(
      jsonRequest({ section: "meta", data: { name: "Jane" } })
    );

    const text = JSON.stringify(await response.json());
    expect(text).not.toContain(process.env.GITHUB_TOKEN ?? "");
  });
});