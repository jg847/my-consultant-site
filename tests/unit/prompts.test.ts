import { describe, expect, test } from "vitest";
import { SECTION_SCHEMAS, SYSTEM_PROMPT, buildUserMessage } from "../../recorder-app/app/api/clean/route";

describe("cleaning prompts", () => {
  test("SYSTEM_PROMPT includes the word professional", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("professional");
  });

  test("SYSTEM_PROMPT instructs JSON-only output", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("return only valid json");
  });

  test("SYSTEM_PROMPT tells Claude to preserve facts", () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("preserve all facts");
  });

  test("buildUserMessage includes transcript", () => {
    const transcript = "uh i can help with training and strategy";
    const message = buildUserMessage(transcript, "services");

    expect(message).toContain(transcript);
  });

  test("buildUserMessage includes section schema", () => {
    const message = buildUserMessage("messy transcript", "hero");
    expect(message).toContain("headline");
    expect(message).toContain(JSON.stringify(SECTION_SCHEMAS.hero, null, 2));
  });
});