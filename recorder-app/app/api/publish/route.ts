import { NextResponse } from "next/server";

const ALLOWED_SECTIONS = ["meta", "hero", "services", "about", "contact"] as const;
type SectionName = (typeof ALLOWED_SECTIONS)[number];

type PublishResponse =
  | { success: true; commitUrl: string }
  | { message: string }
  | { error: string };

type GithubContentGetResponse = {
  content: string;
  sha: string;
};

type GithubContentPutResponse = {
  commit?: {
    html_url?: string;
  };
};

const jsonResponse = (body: PublishResponse, status: number) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getGithubConfig = () => {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  if (!token || !owner || !repo || !branch) {
    throw new Error("Missing GitHub environment configuration");
  }

  return { token, owner, repo, branch };
};

const buildHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28"
});

const toBase64 = (value: string): string => Buffer.from(value, "utf-8").toString("base64");
const fromBase64 = (value: string): string => Buffer.from(value, "base64").toString("utf-8");

export async function handlePublish(
  request: Request,
  method: string = request.method
): Promise<NextResponse<PublishResponse>> {
  if (method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: { section?: unknown; data?: unknown };
  try {
    payload = (await request.json()) as { section?: unknown; data?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const section = payload.section;
  const data = payload.data;

  if (typeof section !== "string" || section.trim().length === 0) {
    return jsonResponse({ error: "Section is required" }, 400);
  }

  if (!(ALLOWED_SECTIONS as readonly string[]).includes(section)) {
    return jsonResponse(
      { error: "Invalid section. Must be one of: meta, hero, services, about, contact" },
      400
    );
  }

  if (data === undefined || data === null) {
    return jsonResponse({ error: "Data is required" }, 400);
  }

  try {
    const { token, owner, repo, branch } = getGithubConfig();
    const sectionName = section as SectionName;
    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content.json`;

    const getResponse = await fetch(githubUrl, {
      method: "GET",
      headers: buildHeaders(token)
    });

    if (!getResponse.ok) {
      throw new Error(`GitHub GET failed: ${getResponse.status}`);
    }

    const getPayload = (await getResponse.json()) as GithubContentGetResponse;
    const currentContentRaw = fromBase64(getPayload.content.replace(/\n/g, ""));
    const currentContent = JSON.parse(currentContentRaw) as Record<string, unknown>;

    const sectionCurrent = currentContent[sectionName];
    const mergedSection =
      isRecord(sectionCurrent) && isRecord(data)
        ? { ...sectionCurrent, ...data }
        : data;

    const updatedContent = {
      ...currentContent,
      [sectionName]: mergedSection
    };

    const updatedContentRaw = JSON.stringify(updatedContent, null, 2);
    const normalizedCurrent = JSON.stringify(JSON.parse(currentContentRaw), null, 2);

    if (updatedContentRaw === normalizedCurrent) {
      return jsonResponse({ message: "No changes detected" }, 409);
    }

    const putResponse = await fetch(githubUrl, {
      method: "PUT",
      headers: {
        ...buildHeaders(token),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: `voice update: ${sectionName} section`,
        content: toBase64(updatedContentRaw),
        sha: getPayload.sha,
        branch
      })
    });

    if (!putResponse.ok) {
      throw new Error(`GitHub PUT failed: ${putResponse.status}`);
    }

    const putPayload = (await putResponse.json()) as GithubContentPutResponse;
    const commitUrl = putPayload.commit?.html_url;

    if (!commitUrl) {
      throw new Error("Missing commit URL in GitHub response");
    }

    return jsonResponse({ success: true, commitUrl }, 200);
  } catch (error) {
    console.error("Publish failed", error);
    return jsonResponse({ error: "GitHub publish failed" }, 500);
  }
}

export async function POST(request: Request): Promise<NextResponse<PublishResponse>> {
  return handlePublish(request, "POST");
}