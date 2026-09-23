import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TranscriptResult } from "./whipscribe";

export interface ActionItem {
  speaker: string;
  task: string;
  deadline: string;
  timestamp: string; // "MM:SS"
  priority: "high" | "medium" | "low";
}

export interface Decision {
  summary: string;
  timestamp: string;
  speakers: string[];
}

export interface Blocker {
  description: string;
  owner: string;
  timestamp: string;
  severity: "critical" | "moderate";
}

export interface ShipUpdate {
  description: string;
  speaker: string;
  timestamp: string;
}

export interface StandupAnalysis {
  title: string;
  summary: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  blockers: Blocker[];
  shipped: ShipUpdate[];
  speakerMap: Record<string, { totalTime: number; segments: number }>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/** Build a readable diarized transcript for the AI prompt */
function buildReadableTranscript(transcript: TranscriptResult): string {
  return transcript.segments
    .map((s) => `[${formatTime(s.start)}] ${s.speaker}: ${s.text}`)
    .join("\n");
}

const EXTRACTION_PROMPT = `You are ShipNotes AI, an engineering standup analyzer. You receive a diarized meeting transcript and extract structured data.

RULES:
- Extract ONLY what is explicitly said. Never infer or hallucinate.
- Every extracted item MUST have a timestamp in MM:SS format from the transcript.
- Speakers are labeled Speaker 0, Speaker 1, etc. Keep those labels.
- Return ONLY valid JSON, no markdown fences, no explanation.

Return this exact JSON structure:
{
  "title": "brief meeting title (5-8 words)",
  "summary": "2-3 sentence summary of the standup",
  "actionItems": [
    {
      "speaker": "Speaker 0",
      "task": "what they committed to do",
      "deadline": "mentioned deadline or 'not specified'",
      "timestamp": "MM:SS",
      "priority": "high|medium|low"
    }
  ],
  "decisions": [
    {
      "summary": "what was decided",
      "timestamp": "MM:SS",
      "speakers": ["Speaker 0", "Speaker 1"]
    }
  ],
  "blockers": [
    {
      "description": "what is blocking progress",
      "owner": "Speaker 0",
      "timestamp": "MM:SS",
      "severity": "critical|moderate"
    }
  ],
  "shipped": [
    {
      "description": "what was completed/shipped since last standup",
      "speaker": "Speaker 0",
      "timestamp": "MM:SS"
    }
  ]
}

If a category has no items, return an empty array. Do NOT make up items.`;

/* ───────── Fallback Rule-Based Extractor (Guarantees 100% Uptime) ───────── */
function fallbackRuleBasedExtractor(transcript: TranscriptResult): Omit<StandupAnalysis, "speakerMap"> {
  const actionItems: ActionItem[] = [];
  const decisions: Decision[] = [];
  const blockers: Blocker[] = [];
  const shipped: ShipUpdate[] = [];

  for (const seg of transcript.segments) {
    const text = seg.text;
    const ts = formatTime(seg.start);

    // Shipped detection
    if (/shipped|finished|completed|deployed|merged|fixed|built/i.test(text)) {
      shipped.push({
        description: text.replace(/^.*?(shipped|finished|completed|deployed|merged|fixed|built)/i, "$1").trim(),
        speaker: seg.speaker,
        timestamp: ts,
      });
    }

    // Blocker detection
    if (/blocked|blocker|blocking|stuck|waiting on|need .*? keys/i.test(text)) {
      blockers.push({
        description: text.trim(),
        owner: seg.speaker,
        timestamp: ts,
        severity: /critical|urgent|asap|today/i.test(text) ? "critical" : "moderate",
      });
    }

    // Action item detection
    if (/will|going to|need to|ping|create|setup|work on|commit/i.test(text)) {
      actionItems.push({
        speaker: seg.speaker,
        task: text.trim(),
        deadline: /today|tomorrow|in \d+|by \d+/i.test(text) ? (text.match(/today|tomorrow|in \d+ \w+|by \d+ \w+/i)?.[0] || "not specified") : "not specified",
        timestamp: ts,
        priority: /urgent|today|asap|minutes/i.test(text) ? "high" : "medium",
      });
    }

    // Decision detection
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

export async function analyzeStandup(
  transcript: TranscriptResult
): Promise<StandupAnalysis> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  // Calculate speaker stats
  const speakerMap: Record<string, { totalTime: number; segments: number }> = {};
  for (const seg of transcript.segments) {
    if (!speakerMap[seg.speaker]) {
      speakerMap[seg.speaker] = { totalTime: 0, segments: 0 };
    }
    speakerMap[seg.speaker].totalTime += seg.end - seg.start;
    speakerMap[seg.speaker].segments += 1;
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const readable = buildReadableTranscript(transcript);

  // Retry with exponential backoff for transient 503 or rate limits
  let parsed: any = null;
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        `\n\nTRANSCRIPT:\n${readable}`,
      ]);

      const text = result.response.text();
      const cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
      break; // Success
    } catch (err: any) {
      console.warn(`Gemini API attempt ${attempt}/${maxRetries} failed:`, err?.message || err);
      if (attempt < maxRetries) {
        // Wait 1.5s, then 3s before retrying
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      } else {
        console.warn("Falling back to local deterministic rule-based extractor.");
        // Fallback guarantees 100% uptime even if Google servers return 503
        parsed = fallbackRuleBasedExtractor(transcript);
      }
    }
  }

  return {
    title: parsed.title || "Sprint Standup",
    summary: parsed.summary || "",
    actionItems: parsed.actionItems || [],
    decisions: parsed.decisions || [],
    blockers: parsed.blockers || [],
    shipped: parsed.shipped || [],
    speakerMap,
  };
}
