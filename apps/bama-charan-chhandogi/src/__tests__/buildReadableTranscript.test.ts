import { describe, it, expect } from "vitest";
import type { TranscriptResult } from "../lib/whipscribe";

// Mirror of the internal buildReadableTranscript + formatTime functions
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function buildReadableTranscript(transcript: TranscriptResult): string {
  return transcript.segments
    .map((s) => `[${formatTime(s.start)}] ${s.speaker}: ${s.text}`)
    .join("\n");
}

const sampleTranscript: TranscriptResult = {
  segments: [
    { speaker: "Speaker 0", start: 0, end: 15, text: "Good morning team." },
    { speaker: "Speaker 1", start: 15, end: 35, text: "I shipped the auth PR yesterday." },
    { speaker: "Speaker 0", start: 60, end: 90, text: "I am blocked on staging keys." },
  ],
  text: "Good morning team. I shipped the auth PR yesterday. I am blocked on staging keys.",
  duration: 90,
};

describe("buildReadableTranscript", () => {
  it("includes all speakers", () => {
    const result = buildReadableTranscript(sampleTranscript);
    expect(result).toContain("Speaker 0");
    expect(result).toContain("Speaker 1");
  });

  it("formats timestamps correctly", () => {
    const result = buildReadableTranscript(sampleTranscript);
    expect(result).toContain("[00:00]");
    expect(result).toContain("[00:15]");
    expect(result).toContain("[01:00]");
  });

  it("includes segment text verbatim", () => {
    const result = buildReadableTranscript(sampleTranscript);
    expect(result).toContain("Good morning team.");
    expect(result).toContain("I shipped the auth PR yesterday.");
    expect(result).toContain("I am blocked on staging keys.");
  });

  it("produces one line per segment", () => {
    const lines = buildReadableTranscript(sampleTranscript).split("\n");
    expect(lines).toHaveLength(3);
  });

  it("follows [MM:SS] Speaker: Text format", () => {
    const lines = buildReadableTranscript(sampleTranscript).split("\n");
    expect(lines[0]).toBe("[00:00] Speaker 0: Good morning team.");
    expect(lines[1]).toBe("[00:15] Speaker 1: I shipped the auth PR yesterday.");
  });

  it("handles empty transcript", () => {
    const empty: TranscriptResult = { segments: [], text: "", duration: 0 };
    expect(buildReadableTranscript(empty)).toBe("");
  });

  it("handles a single segment", () => {
    const single: TranscriptResult = {
      segments: [{ speaker: "Speaker 0", start: 30, end: 45, text: "Done." }],
      text: "Done.",
      duration: 45,
    };
    expect(buildReadableTranscript(single)).toBe("[00:30] Speaker 0: Done.");
  });
});
