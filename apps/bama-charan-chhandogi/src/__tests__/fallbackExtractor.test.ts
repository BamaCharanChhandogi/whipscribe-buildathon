import { describe, it, expect } from "vitest";

/**
 * Mirrors the fallbackRuleBasedExtractor logic from gemini.ts.
 * Tests that keyword-based classification correctly populates shipped/blockers/actions/decisions.
 */

type Segment = { speaker: string; start: number; end: number; text: string };
type TranscriptResult = { segments: Segment[]; text: string; duration: number };

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function fallbackRuleBasedExtractor(transcript: TranscriptResult) {
  const actionItems: any[] = [];
  const decisions: any[] = [];
  const blockers: any[] = [];
  const shipped: any[] = [];

  for (const seg of transcript.segments) {
    const text = seg.text;
    const ts = formatTime(seg.start);

    if (/shipped|finished|completed|deployed|merged|fixed|built/i.test(text)) {
      shipped.push({
        description: text.replace(/^.*?(shipped|finished|completed|deployed|merged|fixed|built)/i, "$1").trim(),
        speaker: seg.speaker,
        timestamp: ts,
      });
    }

    if (/blocked|blocker|blocking|stuck|waiting on|need .*? keys/i.test(text)) {
      blockers.push({
        description: text.trim(),
        owner: seg.speaker,
        timestamp: ts,
        severity: /critical|urgent|asap|today/i.test(text) ? "critical" : "moderate",
      });
    }

    if (/will|going to|need to|ping|create|setup|work on|commit/i.test(text)) {
      actionItems.push({
        speaker: seg.speaker,
        task: text.trim(),
        deadline: /today|tomorrow|in \d+|by \d+/i.test(text)
          ? (text.match(/today|tomorrow|in \d+ \w+|by \d+ \w+/i)?.[0] || "not specified")
          : "not specified",
        timestamp: ts,
        priority: /urgent|today|asap|minutes/i.test(text) ? "high" : "medium",
      });
    }

    if (/agree|agreed|decide|decided|let's|migrate/i.test(text)) {
      decisions.push({
        summary: text.trim(),
        timestamp: ts,
        speakers: [seg.speaker],
      });
    }
  }

  return {
    title: "Engineering Sprint Standup",
    summary: `Standup sync with ${transcript.segments.length} dialogue segments recorded. Key updates extracted across shipped items, blockers, and scheduled tasks.`,
    actionItems,
    decisions,
    blockers,
    shipped,
  };
}

// ----- Fixtures -----

const makeTranscript = (segments: Segment[]): TranscriptResult => ({
  segments,
  text: segments.map((s) => s.text).join(" "),
  duration: segments.at(-1)?.end ?? 0,
});

describe("fallbackRuleBasedExtractor — shipped detection", () => {
  it("detects 'shipped' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "I shipped the auth service." }]);
    const result = fallbackRuleBasedExtractor(t);
    expect(result.shipped).toHaveLength(1);
    expect(result.shipped[0].speaker).toBe("Speaker 0");
  });

  it("detects 'deployed' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 1", start: 10, end: 20, text: "I deployed to production." }]);
    expect(fallbackRuleBasedExtractor(t).shipped).toHaveLength(1);
  });

  it("detects 'merged' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "I merged the PR." }]);
    expect(fallbackRuleBasedExtractor(t).shipped).toHaveLength(1);
  });

  it("does not false-positive on unrelated text", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "Good morning everyone." }]);
    expect(fallbackRuleBasedExtractor(t).shipped).toHaveLength(0);
  });
});

describe("fallbackRuleBasedExtractor — blocker detection", () => {
  it("detects 'blocked' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 60, end: 75, text: "I am blocked on staging keys." }]);
    const result = fallbackRuleBasedExtractor(t);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].owner).toBe("Speaker 0");
    expect(result.blockers[0].severity).toBe("moderate");
  });

  it("detects 'stuck' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 1", start: 0, end: 10, text: "I'm stuck waiting for review." }]);
    expect(fallbackRuleBasedExtractor(t).blockers).toHaveLength(1);
  });

  it("sets severity to critical when 'urgent' present", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "Urgent: I am blocked on the API keys." }]);
    expect(fallbackRuleBasedExtractor(t).blockers[0].severity).toBe("critical");
  });
});

describe("fallbackRuleBasedExtractor — action item detection", () => {
  it("detects 'will' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "I will ping the DevOps team." }]);
    const result = fallbackRuleBasedExtractor(t);
    expect(result.actionItems).toHaveLength(1);
  });

  it("detects 'need to' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 1", start: 0, end: 10, text: "We need to setup the CI pipeline." }]);
    expect(fallbackRuleBasedExtractor(t).actionItems).toHaveLength(1);
  });

  it("sets priority high when 'today' present", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "I will finish the PR today." }]);
    expect(fallbackRuleBasedExtractor(t).actionItems[0].priority).toBe("high");
  });

  it("extracts 'today' as deadline", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "I will fix it today." }]);
    expect(fallbackRuleBasedExtractor(t).actionItems[0].deadline).toBe("today");
  });
});

describe("fallbackRuleBasedExtractor — decision detection", () => {
  it("detects 'agreed' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 0", start: 0, end: 10, text: "We agreed to use TypeScript." }]);
    expect(fallbackRuleBasedExtractor(t).decisions).toHaveLength(1);
  });

  it("detects 'migrate' keyword", () => {
    const t = makeTranscript([{ speaker: "Speaker 1", start: 0, end: 10, text: "Let's migrate to App Router." }]);
    expect(fallbackRuleBasedExtractor(t).decisions).toHaveLength(1);
  });
});

describe("fallbackRuleBasedExtractor — summary and title", () => {
  it("always returns the fixed title", () => {
    const t = makeTranscript([]);
    expect(fallbackRuleBasedExtractor(t).title).toBe("Engineering Sprint Standup");
  });

  it("includes segment count in summary", () => {
    const t = makeTranscript([
      { speaker: "Speaker 0", start: 0, end: 5, text: "Hello." },
      { speaker: "Speaker 1", start: 5, end: 10, text: "Hi." },
    ]);
    expect(fallbackRuleBasedExtractor(t).summary).toContain("2 dialogue segments");
  });

  it("handles empty transcript gracefully", () => {
    const t = makeTranscript([]);
    const result = fallbackRuleBasedExtractor(t);
    expect(result.shipped).toHaveLength(0);
    expect(result.blockers).toHaveLength(0);
    expect(result.actionItems).toHaveLength(0);
    expect(result.decisions).toHaveLength(0);
  });
});
