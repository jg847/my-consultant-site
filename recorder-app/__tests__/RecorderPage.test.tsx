// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import HomePage from "../app/page";

class MockMediaRecorder {
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public state: "inactive" | "recording" = "inactive";

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" })
    });
  }
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

describe("Recorder page", () => {
  beforeEach(() => {
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    vi.stubGlobal(
      "navigator",
      {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] })
        }
      } as unknown as Navigator
    );
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders section selector with all options and initial button states", () => {
    render(<HomePage />);

    expect(screen.getByLabelText("Section")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Meta" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Hero" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Services" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Contact" })).toBeTruthy();

    expect(screen.getByRole("button", { name: "Record" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: "Stop" }).hasAttribute("disabled")).toBe(true);
  });

  test("runs the full pipeline and updates status through stages", async () => {
    const user = userEvent.setup();

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(jsonResponse({ transcript: "Hello world" }))
      .mockResolvedValueOnce(
        jsonResponse({
          cleaned: {
            bio: "Cleaned bio",
            highlights: ["Highlight A"]
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, commitUrl: "https://github.com/commit/abc" }));

    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "Record" }));
    expect(screen.getByRole("button", { name: "Record" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Stop" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText(/Status:\s*Recording/i)).toBeTruthy();

    await waitFor(
      () => {
        expect(screen.getByText(/Timer:\s*00:0[1-9]/i)).toBeTruthy();
      },
      { timeout: 3000 }
    );

    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.getByRole("button", { name: "Transcribe" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Transcribe" }));
    await waitFor(() => {
      expect(screen.getByText(/Status:\s*Reviewing/i)).toBeTruthy();
    });
    expect((screen.getByLabelText("Transcript") as HTMLTextAreaElement).value).toBe("Hello world");

    const transcriptInput = screen.getByLabelText("Transcript");
    await user.clear(transcriptInput);
    await user.type(transcriptInput, "Edited transcript");
    expect((transcriptInput as HTMLTextAreaElement).value).toBe("Edited transcript");
    expect(screen.getByRole("button", { name: "Clean & Preview" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Clean & Preview" }));
    await waitFor(() => {
      expect(screen.getByText(/Status:\s*Previewing/i)).toBeTruthy();
    });
    expect(screen.getByText(/Cleaned bio/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Publish" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => {
      expect(screen.getByText(/Status:\s*Done/i)).toBeTruthy();
    });
    expect(screen.getByText(/Published successfully/i)).toBeTruthy();
  });

  test("shows user-friendly message when API fails", async () => {
    const user = userEvent.setup();

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      jsonResponse({ error: "Transcription service unavailable" }, 500)
    );

    render(<HomePage />);

    await user.click(screen.getByRole("button", { name: "Record" }));
    await user.click(screen.getByRole("button", { name: "Stop" }));
    await user.click(screen.getByRole("button", { name: "Transcribe" }));

    await waitFor(() => {
      expect(screen.getByText(/Status:\s*Error/i)).toBeTruthy();
    });

    const errorMessage = screen.getByRole("alert").textContent ?? "";
    expect(errorMessage).toContain("We couldn't transcribe your recording");
    expect(errorMessage).not.toContain("[object Object]");
  });
});