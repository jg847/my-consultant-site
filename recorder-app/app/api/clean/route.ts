import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const SYSTEM_PROMPT = `You are a content editor for a professional AI consultant's website.
You receive a voice transcript and clean it into polished website copy.
Rules:
- Preserve ALL facts, names, and specific claims from the transcript
- Fix grammar, remove filler words (um, uh, like, you know)
- Keep the tone professional but approachable — not corporate jargon
- Return ONLY valid JSON matching the schema provided. No markdown, no explanation.
- If information is unclear or missing, use a reasonable placeholder in [brackets]`;

export const SECTION_SCHEMAS = {
  meta: {
    name: "string",
    title: "string",
    tagline: "string",
    email: "string",
    linkedin: "string"
  },
  hero: {
    headline: "string",
    subheadline: "string",
    cta_text: "string",
    cta_href: "string"
  },
  services: [
    {
      id: "string",
      title: "string",
      description: "string",
      icon: "string"
    }
  ],
  about: {
    bio: "string",
    highlights: ["string"]
  },
  contact: {
    prompt: "string",
    form_action: "string"
  }
} as const;

type SectionName = keyof typeof SECTION_SCHEMAS;
type CleanResponse = { cleaned: unknown } | { error: string };

const ALLOWED_SECTIONS: SectionName[] = ["meta", "hero", "services", "about", "contact"];

export const cleanDeps = {
  createAnthropicClient: (apiKey: string) => new Anthropic({ apiKey })
};

const jsonResponse = (body: CleanResponse, status: number) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateParsedForSection = (parsed: unknown, section: SectionName): boolean => {
  if (section === "services") {
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return false;
    }

    return parsed.every(
      (service) =>
        isRecord(service) &&
        ["id", "title", "description", "icon"].every((key) => key in service)
    );
  }

  if (!isRecord(parsed)) {
    return false;
  }

  const schema = SECTION_SCHEMAS[section];
  if (!isRecord(schema)) {
    return false;
  }

  return Object.keys(schema).every((key) => key in parsed);
};

export const buildUserMessage = (transcript: string, section: SectionName): string => {
  const schema = SECTION_SCHEMAS[section];

  return [
    `Section: ${section}`,
    `Expected JSON schema:\n${JSON.stringify(schema, null, 2)}`,
    `Raw transcript:\n${transcript}`,
    "Return only the JSON object for this section."
  ].join("\n\n");
};

export async function handleClean(
  request: Request,
  method: string = request.method
): Promise<NextResponse<CleanResponse>> {
  if (method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let payload: { transcript?: unknown; section?: unknown };
  try {
    payload = (await request.json()) as { transcript?: unknown; section?: unknown };
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const transcript = payload.transcript;
  const section = payload.section;

  if (typeof transcript !== "string" || transcript.trim().length === 0) {
    return jsonResponse({ error: "Transcript is required" }, 400);
  }

  if (typeof section !== "string" || section.trim().length === 0) {
    return jsonResponse({ error: "Section is required" }, 400);
  }

  if (!ALLOWED_SECTIONS.includes(section as SectionName)) {
    return jsonResponse(
      { error: "Invalid section. Must be one of: meta, hero, services, about, contact" },
      400
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Missing API key" }, 500);
  }

  const selectedSection = section as SectionName;

  try {
    const anthropic = cleanDeps.createAnthropicClient(apiKey);
    const userMessage = buildUserMessage(transcript, selectedSection);

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }]
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const responseText = textBlock && "text" in textBlock ? textBlock.text : "";

    try {
      const cleaned = responseText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!validateParsedForSection(parsed, selectedSection)) {
        throw new Error("Schema mismatch");
      }

      return jsonResponse({ cleaned: parsed }, 200);
    } catch {
      return jsonResponse({ error: "Failed to parse AI response" }, 500);
    }
  } catch (error) {
    console.error("Content cleaning failed", error);
    return jsonResponse({ error: "Cleaning service unavailable" }, 500);
  }
}

export async function POST(request: Request): Promise<NextResponse<CleanResponse>> {
  return handleClean(request, "POST");
}