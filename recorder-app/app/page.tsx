"use client";

import { useEffect, useReducer, useRef } from "react";

type Section = "meta" | "hero" | "services" | "about" | "contact";
type Stage =
  | "idle"
  | "recording"
  | "transcribing"
  | "reviewing"
  | "cleaning"
  | "previewing"
  | "publishing"
  | "done"
  | "error";

type State = {
  section: Section;
  stage: Stage;
  elapsedSeconds: number;
  audioBlob: Blob | null;
  transcript: string;
  cleanedContent: unknown;
  successMessage: string;
  errorMessage: string;
};

type Action =
  | { type: "setSection"; section: Section }
  | { type: "setStage"; stage: Stage }
  | { type: "tick" }
  | { type: "setAudioBlob"; blob: Blob | null }
  | { type: "setTranscript"; transcript: string }
  | { type: "setCleanedContent"; cleanedContent: unknown }
  | { type: "setSuccess"; message: string }
  | { type: "setError"; message: string }
  | { type: "resetTransient" };

const initialState: State = {
  section: "meta",
  stage: "idle",
  elapsedSeconds: 0,
  audioBlob: null,
  transcript: "",
  cleanedContent: null,
  successMessage: "",
  errorMessage: ""
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "setSection":
      return { ...state, section: action.section };
    case "setStage":
      return {
        ...state,
        stage: action.stage,
        elapsedSeconds: action.stage === "recording" ? 0 : state.elapsedSeconds
      };
    case "tick":
      return { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
    case "setAudioBlob":
      return { ...state, audioBlob: action.blob };
    case "setTranscript":
      return { ...state, transcript: action.transcript };
    case "setCleanedContent":
      return { ...state, cleanedContent: action.cleanedContent };
    case "setSuccess":
      return { ...state, successMessage: action.message, errorMessage: "" };
    case "setError":
      return { ...state, errorMessage: action.message, successMessage: "", stage: "error" };
    case "resetTransient":
      return { ...state, errorMessage: "", successMessage: "" };
    default:
      return state;
  }
};

const sectionLabels: Record<Section, string> = {
  meta: "Meta",
  hero: "Hero",
  services: "Services",
  about: "About",
  contact: "Contact"
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

const toStageLabel = (stage: Stage): string => `${stage.charAt(0).toUpperCase()}${stage.slice(1)}`;

function ActionButton({
  onClick,
  disabled,
  children,
  variant = "primary"
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const base = "rounded-md px-4 py-2 text-sm font-semibold transition";
  const variantClass =
    variant === "secondary"
      ? "bg-slate-600 text-white hover:bg-slate-700"
      : variant === "danger"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-[#1e3a5f] text-white hover:bg-[#16314f]";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <button className={`${base} ${variantClass} ${disabledClass}`} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function PipelineStatus({ stage }: { stage: Stage }) {
  const colorClass =
    stage === "done"
      ? "bg-green-100 text-green-800"
      : stage === "error"
        ? "bg-red-100 text-red-800"
        : "bg-blue-100 text-blue-800";

  return (
    <div className={`rounded-md px-3 py-2 text-sm font-medium ${colorClass}`}>Status: {toStageLabel(stage)}</div>
  );
}

function SectionSelector({
  value,
  onChange
}: {
  value: Section;
  onChange: (value: Section) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="section" className="block text-sm font-semibold text-slate-800">
        Section
      </label>
      <select
        id="section"
        value={value}
        onChange={(event) => onChange(event.target.value as Section)}
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      >
        {Object.entries(sectionLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RecorderControls({
  isRecording,
  timer,
  onRecord,
  onStop
}: {
  isRecording: boolean;
  timer: string;
  onRecord: () => void;
  onStop: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <ActionButton onClick={onRecord} disabled={isRecording}>
          Record
        </ActionButton>
        <ActionButton onClick={onStop} disabled={!isRecording} variant="danger">
          Stop
        </ActionButton>
      </div>
      <p className="text-sm text-slate-700">Timer: {timer}</p>
    </div>
  );
}

function TranscriptEditor({
  transcript,
  onChange
}: {
  transcript: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="transcript" className="block text-sm font-semibold text-slate-800">
        Transcript
      </label>
      <textarea
        id="transcript"
        value={transcript}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-32 w-full rounded-md border border-slate-300 px-3 py-2"
      />
    </div>
  );
}

function ContentPreview({ transcript, cleanedContent }: { transcript: string; cleanedContent: unknown }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Current</h3>
        <pre className="whitespace-pre-wrap text-xs text-slate-700">{transcript}</pre>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">New</h3>
        <pre className="whitespace-pre-wrap text-xs text-slate-800">
          {JSON.stringify(cleanedContent, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (state.stage !== "recording") {
      return;
    }

    const id = window.setInterval(() => {
      dispatch({ type: "tick" });
    }, 1000);

    return () => window.clearInterval(id);
  }, [state.stage]);

  const handleRecord = async () => {
    dispatch({ type: "resetTransient" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunks.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunks.current.push(event.data);
        }
      };

      recorder.start();
      mediaRecorder.current = recorder;
      dispatch({ type: "setStage", stage: "recording" });
    } catch {
      dispatch({ type: "setError", message: "Unable to access your microphone. Please check permissions." });
    }
  };

const handleStop = () => {
  dispatch({ type: "resetTransient" });
  const recorder = mediaRecorder.current;
  if (!recorder) {
    return;
  }

  recorder.onstop = () => {
    const blob = new Blob(chunks.current, { type: "audio/webm" });
    dispatch({ type: "setAudioBlob", blob });
    dispatch({ type: "setStage", stage: "idle" });
  };

  recorder.stop();
};

  const handleTranscribe = async () => {
    if (!state.audioBlob) {
      dispatch({ type: "setError", message: "Please record audio before transcribing." });
      return;
    }

    dispatch({ type: "setStage", stage: "transcribing" });
    dispatch({ type: "resetTransient" });

    try {
      const formData = new FormData();
      formData.set("audio", state.audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("transcribe_failed");
      }

      const result = (await response.json()) as { transcript?: string };
      dispatch({ type: "setTranscript", transcript: result.transcript ?? "" });
      dispatch({ type: "setStage", stage: "reviewing" });
    } catch {
      dispatch({ type: "setError", message: "We couldn't transcribe your recording. Please try again." });
    }
  };

  const handleClean = async () => {
    if (!state.transcript.trim()) {
      dispatch({ type: "setError", message: "Please enter transcript text before cleaning." });
      return;
    }

    dispatch({ type: "setStage", stage: "cleaning" });
    dispatch({ type: "resetTransient" });

    try {
      const response = await fetch("/api/clean", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          section: state.section,
          transcript: state.transcript
        })
      });

      if (!response.ok) {
        throw new Error("clean_failed");
      }

      const result = (await response.json()) as { cleaned?: unknown };
      dispatch({ type: "setCleanedContent", cleanedContent: result.cleaned ?? {} });
      dispatch({ type: "setStage", stage: "previewing" });
    } catch {
      dispatch({ type: "setError", message: "We couldn't clean the content right now. Please try again." });
    }
  };

  const handlePublish = async () => {
    if (!state.cleanedContent) {
      dispatch({ type: "setError", message: "Please clean and preview content before publishing." });
      return;
    }

    dispatch({ type: "setStage", stage: "publishing" });
    dispatch({ type: "resetTransient" });

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          section: state.section,
          data: state.cleanedContent
        })
      });

      if (!response.ok) {
        throw new Error("publish_failed");
      }

      dispatch({ type: "setStage", stage: "done" });
      dispatch({ type: "setSuccess", message: "Published successfully. Your website update is on its way." });
    } catch {
      dispatch({ type: "setError", message: "We couldn't publish the update. Please try again." });
    }
  };

  const shouldShowTranscriptEditor = [
    "reviewing",
    "cleaning",
    "previewing",
    "publishing",
    "done",
    "error"
  ].includes(state.stage);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1e3a5f] py-4 text-white">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-xl font-semibold">Site Updater</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="rounded-lg bg-white p-5 shadow-sm">
          <PipelineStatus stage={state.stage} />
        </div>

        <div className="space-y-5 rounded-lg bg-white p-5 shadow-sm">
          <SectionSelector
            value={state.section}
            onChange={(section) => dispatch({ type: "setSection", section })}
          />

          <RecorderControls
            isRecording={state.stage === "recording"}
            timer={formatTime(state.elapsedSeconds)}
            onRecord={handleRecord}
            onStop={handleStop}
          />

          {state.audioBlob && state.stage !== "recording" ? (
            <ActionButton onClick={handleTranscribe}>Transcribe</ActionButton>
          ) : null}

          {shouldShowTranscriptEditor ? (
            <>
              <TranscriptEditor
                transcript={state.transcript}
                onChange={(transcript) => dispatch({ type: "setTranscript", transcript })}
              />
              <ActionButton
                onClick={handleClean}
                variant="secondary"
                disabled={!state.transcript.trim()}
              >
                Clean & Preview
              </ActionButton>
            </>
          ) : null}

          {state.cleanedContent ? (
            <>
              <ContentPreview transcript={state.transcript} cleanedContent={state.cleanedContent} />
              <ActionButton onClick={handlePublish}>Publish</ActionButton>
            </>
          ) : null}

          {state.errorMessage ? (
            <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
              {state.errorMessage}
            </p>
          ) : null}

          {state.successMessage ? (
            <p className="rounded-md bg-green-100 px-3 py-2 text-sm text-green-800">
              {state.successMessage}
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
