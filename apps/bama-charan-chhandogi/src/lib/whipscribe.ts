const BASE = "https://whipscribe.com/api/v1";

export interface WhipScribeJob {
  job_id: string;
  status: "queued" | "processing" | "done" | "failed";
  speech_detected?: boolean;
  locked?: boolean;
  duration_seconds?: number;
}

export interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  text: string;
  duration: number;
}

function headers(): Record<string, string> {
  const key = process.env.WHIPSCRIBE_API_KEY;
  if (!key) throw new Error("WHIPSCRIBE_API_KEY is not set");
  return {
    "X-API-Key": key,
    "X-User-Email": "b.c.chhandogi@gmail.com",
  };
}

/** Upload a file to WhipScribe for transcription */
export async function submitFile(file: File): Promise<WhipScribeJob> {
  const form = new FormData();
  form.append("file", file);
  form.append("diarize", "true");
  form.append("word_timestamps", "true");
  form.append("source", "api");
  form.append("language", "en");

  const res = await fetch(`${BASE}/transcribe`, {
    method: "POST",
    headers: headers(),
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhipScribe submit failed (${res.status}): ${err}`);
  }
  return res.json();
}

/** Submit a public URL for transcription */
export async function submitUrl(url: string): Promise<WhipScribeJob> {
  const res = await fetch(`${BASE}/transcribe/url`, {
    method: "POST",
    headers: {
      ...headers(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      diarize: true,
      word_timestamps: true,
      source: "url",
      language: "en",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhipScribe URL submit failed (${res.status}): ${err}`);
  }
  return res.json();
}

/** Poll job status */
export async function getJobStatus(jobId: string): Promise<WhipScribeJob> {
  const res = await fetch(`${BASE}/jobs/${jobId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Job status failed (${res.status})`);
  return res.json();
}

/** Fetch completed transcript as JSON */
export async function getTranscript(jobId: string): Promise<TranscriptResult> {
  const res = await fetch(`${BASE}/jobs/${jobId}/result?format=json`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Transcript fetch failed (${res.status})`);
  const data = await res.json();

  // Normalize segments
  const segments: TranscriptSegment[] = (data.segments || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => ({
      speaker: s.speaker || "Unknown",
      start: s.start || 0,
      end: s.end || 0,
      text: s.text || "",
      words: s.words,
    })
  );

  const fullText = segments.map((s) => s.text).join(" ");
  const duration = segments.length
    ? segments[segments.length - 1].end
    : data.duration || 0;

  return { segments, text: fullText, duration };
}
