import OpenAI from "openai";
import { NextResponse } from "next/server";

export type TranscribeResponse = { transcript: string } | { error: string };

export const routeDeps = {
  createOpenAIClient: (apiKey: string) => new OpenAI({ apiKey })
};

const jsonResponse = (body: TranscribeResponse, status: number) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });

export async function handleTranscribe(
  request: Request,
  method: string = request.method
): Promise<NextResponse<TranscribeResponse>> {
  if (method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "Missing API key" }, 500);
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!(audioFile instanceof File)) {
      return jsonResponse({ error: "Audio file is required" }, 400);
    }

    if (audioFile.size === 0) {
      return jsonResponse({ error: "Audio file is empty" }, 400);
    }

    const openai = routeDeps.createOpenAIClient(apiKey);
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile
    });

    return jsonResponse({ transcript: transcription.text }, 200);
  } catch (error) {
    console.error("Transcription failed", error);
    return jsonResponse({ error: "Transcription service unavailable" }, 500);
  }
}

export async function POST(request: Request): Promise<NextResponse<TranscribeResponse>> {
  return handleTranscribe(request, "POST");
}