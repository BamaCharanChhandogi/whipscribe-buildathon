"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/* ───────── Types ───────── */
interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}
interface ActionItem {
  speaker: string;
  task: string;
  deadline: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
}
interface Decision {
  summary: string;
  timestamp: string;
  speakers: string[];
}
interface Blocker {
  description: string;
  owner: string;
  timestamp: string;
  severity: "critical" | "moderate";
}
interface ShipUpdate {
  description: string;
  speaker: string;
  timestamp: string;
}
interface Analysis {
  title: string;
  summary: string;
  actionItems: ActionItem[];
  decisions: Decision[];
  blockers: Blocker[];
  shipped: ShipUpdate[];
  speakerMap: Record<string, { totalTime: number; segments: number }>;
}
interface Transcript {
  segments: TranscriptSegment[];
  text: string;
  duration: number;
}

type AppState = "idle" | "uploading" | "processing" | "analyzing" | "done" | "error";

const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/* ───────── Minimal Geometric SVG Icons ───────── */
function IconPlay({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
    </svg>
  );
}

function IconMic({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
    </svg>
  );
}

function IconStop({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function IconUpload({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function IconExternal({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function IconCopy({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function IconCheck({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconDownload({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

/* ───────── Evaluation Vector (Instant 0s Preview) ───────── */
const SAMPLE_TRANSCRIPT: Transcript = {
  duration: 36,
  text: "Good morning team. Quick sprint sync. Yesterday I shipped the authentication refactor with Clerk, and all test suites are passing. Great. I am working on the payment webhook integration. But I am currently blocked on the Stripe API test keys from DevOps, and I need them by today afternoon. Got it. I will ping Alex to get the Stripe keys within ten minutes. Also, let us agree to migrate to PostgreSQL instead of MongoDB for our primary database. Agreed. PostgreSQL is much better for relational integrity. I will create the Drizzle schema and database migrations by tomorrow morning.",
  segments: [
    {
      speaker: "Speaker 0",
      start: 0,
      end: 7.2,
      text: "Good morning team. Quick sprint sync. Yesterday I shipped the authentication refactor with Clerk, and all test suites are passing.",
    },
    {
      speaker: "Speaker 1",
      start: 8.0,
      end: 17.1,
      text: "Great. I am working on the payment webhook integration. But I am currently blocked on the Stripe API test keys from DevOps, and I need them by today afternoon.",
    },
    {
      speaker: "Speaker 0",
      start: 18.0,
      end: 26.3,
      text: "Got it. I will ping Alex to get the Stripe keys within ten minutes. Also, let us agree to migrate to PostgreSQL instead of MongoDB for our primary database.",
    },
    {
      speaker: "Speaker 1",
      start: 27.2,
      end: 35.8,
      text: "Agreed. PostgreSQL is much better for relational integrity. I will create the Drizzle schema and database migrations by tomorrow morning.",
    },
  ],
};

const SAMPLE_ANALYSIS: Analysis = {
  title: "Sprint Sync: Auth Shipped, Stripe Unblock & Postgres Migration",
  summary:
    "Speaker 0 shipped the Clerk authentication refactor with all test suites passing and agreed to unblock Speaker 1 by pinging Alex for Stripe test keys. The team confirmed an architectural migration to PostgreSQL over MongoDB, with Speaker 1 owning Drizzle schema migrations due tomorrow morning.",
  actionItems: [
    {
      speaker: "Speaker 0",
      task: "Ping Alex to provision Stripe API test keys for payment webhooks",
      deadline: "Within 10 minutes",
      timestamp: "00:18",
      priority: "high",
    },
    {
      speaker: "Speaker 1",
      task: "Create Drizzle ORM schema and PostgreSQL database migrations",
      deadline: "Tomorrow morning",
      timestamp: "00:27",
      priority: "medium",
    },
  ],
  decisions: [
    {
      summary: "Migrate primary application database to PostgreSQL instead of MongoDB for relational integrity",
      timestamp: "00:18",
      speakers: ["Speaker 0", "Speaker 1"],
    },
  ],
  blockers: [
    {
      description: "Payment webhook integration blocked on Stripe API test keys from DevOps",
      owner: "Speaker 1",
      timestamp: "00:08",
      severity: "critical",
    },
  ],
  shipped: [
    {
      description: "Clerk authentication refactor with full test suite passing",
      speaker: "Speaker 0",
      timestamp: "00:00",
    },
  ],
  speakerMap: {
    "Speaker 0": { totalTime: 15.5, segments: 2 },
    "Speaker 1": { totalTime: 17.7, segments: 2 },
  },
};

/* ───────── Main Component ───────── */
export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState<"actions" | "github" | "slack" | "transcript">("actions");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({
    "Speaker 0": "Alex (Lead)",
    "Speaker 1": "Sarah (Backend)",
    Unknown: "Bama (Dev)",
  });
  const [targetRepo, setTargetRepo] = useState<string>("BamaCharanChhandogi/shipnotes");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Audio state */
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  /* Recording state */
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  /* Processing progress state */
  const [processSeconds, setProcessSeconds] = useState(0);
  const [jobProgress, setJobProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (state === "uploading" || state === "processing" || state === "analyzing") {
      setProcessSeconds(0);
      setJobProgress(10);
      interval = setInterval(() => {
        setProcessSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  /* ── Upload & Process ── */
  const handleUpload = useCallback(async (file: File) => {
    setState("uploading");
    setJobProgress(15);
    setError("");
    setFileName(file.name);
    setAudioUrl(URL.createObjectURL(file));

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setJobId(data.job_id);
      setJobProgress(30);
      setState("processing");
      pollJob(data.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    }
  }, []);

  /* ── Poll WhipScribe Status ── */
  const pollJob = useCallback(async (id: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const res = await fetch(`/api/status/${id}?_t=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        const job = await res.json();

        if (typeof job.progress === "number" && job.progress > 0) {
          setJobProgress(job.progress);
        } else {
          setJobProgress((p) => Math.min(p + 8, 92));
        }

        if (job.status === "done") {
          setJobProgress(95);
          setState("analyzing");
          await runAnalysis(id);
          return;
        }
        if (job.status === "failed") {
          throw new Error("Transcription failed on WhipScribe GPU cluster.");
        }
        if (job.locked) {
          throw new Error("Transcript locked due to credit balance.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Polling error");
        setState("error");
        return;
      }
    }
    setError("Job timed out after 6 minutes.");
    setState("error");
  }, []);

  /* ── Fetch Transcript & Gemini AI Analysis ── */
  const runAnalysis = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setTranscript(data.transcript);
      setAnalysis(data.analysis);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setState("error");
    }
  }, []);

  /* ── Live In-Browser Recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `standup_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        handleUpload(audioFile);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setError("");
    } catch {
      setError("Microphone permission was denied or unavailable.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /* ── Evaluator Test Vectors ── */
  const handleTrySampleLive = async () => {
    try {
      setState("uploading");
      setError("");
      setFileName("sample-standup.wav");
      setAudioUrl("/sample-standup.wav");

      const response = await fetch("/sample-standup.wav");
      const blob = await response.blob();
      const sampleFile = new File([blob], "sample-standup.wav", { type: "audio/wav" });
      await handleUpload(sampleFile);
    } catch {
      setError("Failed to fetch evaluation sample audio.");
      setState("error");
    }
  };

  const handleInstantPreview = () => {
    setFileName("sample-standup.wav");
    setAudioUrl("/sample-standup.wav");
    setJobId("eval-sprint-vector-01");
    setTranscript(SAMPLE_TRANSCRIPT);
    setAnalysis(SAMPLE_ANALYSIS);
    setSpeakerNames({
      "Speaker 0": "Alex (Lead)",
      "Speaker 1": "Sarah (Backend)",
      Unknown: "Bama (Dev)",
    });
    setState("done");
  };

  /* ── Audio Seeking ── */
  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
    }
  };

  const parseTs = (ts: string): number => {
    const [m, s] = ts.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  };

  const spk = (id: string) => speakerNames[id] || (id === "Unknown" ? "Bama (Dev)" : id);

  /* ── Copy Helper ── */
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  /* ── GitHub Issues Generator ── */
  const generateGitHubIssues = () => {
    if (!analysis) return [];
    return analysis.actionItems.map((item, i) => {
      const issueTitle = `[ShipNotes] ${item.task}`;
      const issueBody = `### Action Item from Sprint Standup\n\n- **Assignee:** @${spk(item.speaker)}\n- **Priority:** ${item.priority.toUpperCase()}\n- **Deadline:** ${item.deadline}\n- **Quoted Evidence:** \`[${item.timestamp}]\` in standup recording\n\n> Extracted automatically by [ShipNotes](https://github.com/BamaCharanChhandogi/shipnotes) via WhipScribe API.\n\n*Reference Job: \`${jobId}\`*`;
      const labels = [item.priority === "high" ? "urgent" : "task", "shipnotes"];

      const prefillUrl = `https://github.com/${targetRepo}/issues/new?title=${encodeURIComponent(
        issueTitle
      )}&body=${encodeURIComponent(issueBody)}&labels=${encodeURIComponent(labels.join(","))}`;

      return {
        id: i,
        title: issueTitle,
        body: issueBody,
        labels,
        assignee: spk(item.speaker),
        prefillUrl,
      };
    });
  };

  /* ── Slack Digest Generator ── */
  const generateSlackDigest = () => {
    if (!analysis) return "";
    const lines = [
      `*${analysis.title}*`,
      analysis.summary,
      "",
      `*Shipped (${analysis.shipped.length})*`,
      ...analysis.shipped.map((s) => `• ${s.description} — _${spk(s.speaker)}_ (\`${s.timestamp}\`)`),
      "",
      `*Action Items (${analysis.actionItems.length})*`,
      ...analysis.actionItems.map(
        (a) =>
          `• ${a.priority === "high" ? "[URGENT]" : "[TASK]"} *${a.task}* — _${spk(
            a.speaker
          )}_ (Due: ${a.deadline}) [\`${a.timestamp}\`]`
      ),
      "",
    ];
    if (analysis.blockers.length) {
      lines.push(
        `*Blockers (${analysis.blockers.length})*`,
        ...analysis.blockers.map((b) => `• ${b.description} — _${spk(b.owner)}_ (\`${b.timestamp}\`)`),
        ""
      );
    }
    if (analysis.decisions.length) {
      lines.push(
        `*Decisions (${analysis.decisions.length})*`,
        ...analysis.decisions.map((d) => `• ${d.summary} (\`${d.timestamp}\`)`),
        ""
      );
    }
    lines.push("_Generated via ShipNotes · WhipScribe API_");
    return lines.join("\n");
  };

  /* ── Download Markdown Report ── */
  const downloadMarkdownReport = () => {
    if (!analysis || !transcript) return;
    const content = `# ${analysis.title}
Recorded duration: ${fmt(transcript.duration)} | Extracted via ShipNotes

## Summary
${analysis.summary}

## Shipped
${analysis.shipped.map((s) => `- ${s.description} (${spk(s.speaker)} at ${s.timestamp})`).join("\n")}

## Action Items
${analysis.actionItems
  .map(
    (a) =>
      `- [ ] ${a.task} (Owner: @${spk(a.speaker)} | Priority: ${a.priority} | Due: ${a.deadline} | Evidence: [${a.timestamp}])`
  )
  .join("\n")}

## Blockers
${analysis.blockers.map((b) => `- ${b.description} (Owner: ${spk(b.owner)} | Severity: ${b.severity})`).join("\n")}

## Decisions
${analysis.decisions.map((d) => `- ${d.summary} (Agreed by: ${d.speakers.map(spk).join(", ")})`).join("\n")}

---
### Diarized Dialogue
${transcript.segments.map((s) => `[${fmt(s.start)}] ${spk(s.speaker)}: ${s.text}`).join("\n\n")}
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `standup_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─────────────────── RENDER ─────────────────── */

  /* ── View 1: Landing & Capture ── */
  if (state === "idle" || state === "error") {
    return (
      <div className="min-h-screen bg-[#fafcf9] text-[#111827] flex flex-col justify-between">
        {/* WhipScribe Signature Top Navbar */}
        <header className="bg-white border-b border-[#e2ede5] px-6 py-3.5 sticky top-0 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* WhipScribe Logo */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#88d927] text-black font-black text-sm flex items-center justify-center shadow-xs">
                  w
                </div>
                <span className="font-bold text-lg text-[#111827] tracking-tight">WhipScribe</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-gray-300 text-gray-500 font-medium">
                  beta
                </span>
              </div>
              <span className="text-gray-300">/</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#edf7f0] text-[#1e4d35] border border-[#d5e8da]">
                Track 4 · ShipNotes
              </span>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[#1e4d35] font-medium bg-[#edf7f0] px-2.5 py-1 rounded-full border border-[#d5e8da]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#276244] animate-pulse" />
                API Online
              </span>
              <a
                href="https://github.com/BamaCharanChhandogi/shipnotes"
                target="_blank"
                rel="noreferrer"
                className="text-[#4b5563] hover:text-[#111827] font-medium flex items-center gap-1 transition-colors"
              >
                <span>GitHub</span>
                <IconExternal className="w-3 h-3" />
              </a>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <main className="max-w-4xl mx-auto px-6 py-10 w-full space-y-10 my-auto">
          {/* WhipScribe Signature Editorial Hero */}
          <div className="text-center space-y-4 pt-2">
            <h1 className="text-4xl sm:text-5xl font-serif font-bold text-[#111827] tracking-tight">
              Stop listening. Start{" "}
              <span className="italic text-[#1e4d35] underline decoration-[#1e4d35] decoration-2 underline-offset-8">
                shipping
              </span>
              .
            </h1>
            <p className="text-[#4b5563] text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
              <strong className="text-[#111827]">Private</strong> — transcribed on WhipScribe GPU servers with speaker diarization.{" "}
              <strong className="text-[#111827]">Fast</strong> — 5-minute standup processed in seconds.{" "}
              <strong className="text-[#111827]">Actionable</strong> — commits directly to GitHub Issues and Slack digests.
            </p>
          </div>

          {/* WhipScribe Action Deck (Inspired by Library top cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Card 1: 1-Click Instant Preview */}
            <div
              onClick={handleInstantPreview}
              className="p-4 bg-white hover:bg-[#f2f9f4] border border-[#d5e8da] hover:border-[#276244] rounded-xl transition-all cursor-pointer shadow-xs group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#edf7f0] group-hover:bg-[#1e4d35] group-hover:text-white text-[#1e4d35] flex items-center justify-center transition-colors">
                  <IconPlay className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-[#111827] group-hover:text-[#1e4d35] pt-1">
                  1-Click Preview
                </h3>
                <p className="text-xs text-[#6b7280] leading-snug">
                  0s instant evaluator demo with sample standup
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#1e4d35] mt-3 block">
                Open Instant Demo →
              </span>
            </div>

            {/* Card 2: Run Live API on Sample */}
            <div
              onClick={handleTrySampleLive}
              className="p-4 bg-white hover:bg-[#f2f9f4] border border-[#d5e8da] hover:border-[#276244] rounded-xl transition-all cursor-pointer shadow-xs group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#edf7f0] group-hover:bg-[#1e4d35] group-hover:text-white text-[#1e4d35] flex items-center justify-center transition-colors">
                  <span className="font-mono text-xs font-bold">API</span>
                </div>
                <h3 className="font-semibold text-sm text-[#111827] group-hover:text-[#1e4d35] pt-1">
                  Run Live API
                </h3>
                <p className="text-xs text-[#6b7280] leading-snug">
                  Process sample-standup.wav on WhipScribe GPU
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#1e4d35] mt-3 block">
                Run GPU Pipeline →
              </span>
            </div>

            {/* Card 3: Record Live Mic */}
            <div
              onClick={() => {
                if (!isRecording) startRecording();
                else stopRecording();
              }}
              className={`p-4 border rounded-xl transition-all cursor-pointer shadow-xs flex flex-col justify-between ${
                isRecording
                  ? "bg-red-50 border-red-300"
                  : "bg-white hover:bg-[#f2f9f4] border-[#d5e8da] hover:border-[#276244]"
              }`}
            >
              <div className="space-y-1.5">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isRecording ? "bg-red-500 text-white animate-pulse" : "bg-[#edf7f0] text-[#1e4d35]"
                  }`}
                >
                  <IconMic className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-[#111827] pt-1">
                  {isRecording ? "Recording..." : "Record Audio"}
                </h3>
                <p className="text-xs text-[#6b7280] leading-snug">
                  {isRecording ? `${fmt(recordSeconds)} elapsed` : "Start with your browser microphone"}
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold mt-3 block ${
                  isRecording ? "text-red-600" : "text-[#1e4d35]"
                }`}
              >
                {isRecording ? "Click to Stop & Submit" : "Start Recording →"}
              </span>
            </div>

            {/* Card 4: Upload Audio File */}
            <div
              onClick={() => fileRef.current?.click()}
              className="p-4 bg-white hover:bg-[#f2f9f4] border border-[#d5e8da] hover:border-[#276244] rounded-xl transition-all cursor-pointer shadow-xs group flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="w-8 h-8 rounded-lg bg-[#edf7f0] group-hover:bg-[#1e4d35] group-hover:text-white text-[#1e4d35] flex items-center justify-center transition-colors">
                  <IconUpload className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-[#111827] group-hover:text-[#1e4d35] pt-1">
                  Upload Files
                </h3>
                <p className="text-xs text-[#6b7280] leading-snug">
                  Audio or video · MP3, WAV, M4A, WebM
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#1e4d35] mt-3 block">
                Select from Disk →
              </span>
            </div>
          </div>

          {/* WhipScribe Styled Upload Hero Card (Matching Image 2 / 3) */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleUpload(f);
            }}
            className="p-8 sm:p-10 bg-[#f2f9f4] border-2 border-dashed border-[#d5e8da] rounded-2xl text-center space-y-4"
          >
            {/* 3 Line-Art Icons (Mic, Waveform, Camera doodle like Image 2) */}
            <div className="flex items-center justify-center gap-3 text-[#276244]">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#d5e8da] flex items-center justify-center shadow-xs">
                <IconMic className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 rounded-xl bg-white border border-[#d5e8da] flex items-center justify-center shadow-xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v4m4-8v12m4-14v16m4-10v4m4-8v12" />
                </svg>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white border border-[#d5e8da] flex items-center justify-center shadow-xs">
                <IconUpload className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#111827]">
                Drag & drop your standup recording here
              </h2>
              <p className="text-xs text-[#6b7280]">
                Supports MP3, WAV, M4A, AAC, WebM up to 50MB · Multi-speaker diarization enabled
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 bg-[#1e4d35] hover:bg-[#183f2a] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                Choose Audio File
              </button>
              <button
                onClick={handleInstantPreview}
                className="px-4 py-2.5 bg-white hover:bg-gray-50 border border-[#d5e8da] text-[#1e4d35] text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Instant Preview (sample-standup.wav)
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.webm,.ogg,.flac"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </div>

          {/* Configuration Card: Target Repository */}
          <div className="p-4 bg-white border border-[#e2ede5] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="space-y-0.5">
              <label htmlFor="repo-input" className="font-semibold text-[#111827] block">
                Target GitHub Repository
              </label>
              <p className="text-[#6b7280] text-[11px]">
                Clicking &quot;Open on GitHub&quot; pre-fills issue tickets directly into this repository.
              </p>
            </div>
            <input
              id="repo-input"
              type="text"
              value={targetRepo}
              onChange={(e) => setTargetRepo(e.target.value)}
              className="px-3 py-1.5 bg-[#fafcf9] border border-[#d5e8da] focus:border-[#1e4d35] focus:outline-none rounded-lg font-mono text-xs text-[#111827] w-full sm:w-64"
              placeholder="owner/repo"
            />
          </div>

          {/* Error Notice */}
          {state === "error" && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => {
                  setState("idle");
                  setError("");
                }}
                className="underline hover:text-red-950 font-semibold"
              >
                Reset
              </button>
            </div>
          )}
        </main>

        {/* WhipScribe Signature Footer */}
        <footer className="bg-white border-t border-[#e2ede5] py-4 px-6 text-xs text-[#6b7280]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              ShipNotes by <strong>Bama Charan Chhandogi</strong> · WhipScribe Buildathon Track 4
            </span>
            <div className="flex items-center gap-4">
              <a href="https://bamacharan.com" target="_blank" rel="noreferrer" className="hover:text-[#111827]">
                bamacharan.com
              </a>
              <span>·</span>
              <a href="https://github.com/BamaCharanChhandogi" target="_blank" rel="noreferrer" className="hover:text-[#111827]">
                GitHub
              </a>
              <span>·</span>
              <a href="https://www.linkedin.com/in/bamacharanchhandogi/" target="_blank" rel="noreferrer" className="hover:text-[#111827]">
                LinkedIn
              </a>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  /* ── View 2: Processing State (WhipScribe Style) ── */
  if (state === "uploading" || state === "processing" || state === "analyzing") {
    const stepLabel =
      state === "uploading"
        ? "Uploading audio to WhipScribe GPU cluster..."
        : state === "processing"
        ? "Running WhipScribe GPU diarization & word alignment..."
        : "Extracting action items, blockers, and decisions with Gemini...";

    return (
      <div className="min-h-screen bg-[#fafcf9] text-[#111827] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-[#d5e8da] rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between text-xs border-b border-[#e2ede5] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#88d927] text-black font-black text-xs flex items-center justify-center">
                w
              </div>
              <span className="font-semibold text-[#1e4d35]">
                {state === "uploading" ? "Audio Transfer" : state === "processing" ? "GPU Diarization" : "AI Synthesis"}
              </span>
            </div>
            <span className="font-mono text-[#6b7280]">Elapsed: {processSeconds}s</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#111827] font-medium">{stepLabel}</span>
              <span className="font-mono font-bold text-[#1e4d35]">{jobProgress}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-[#edf7f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1e4d35] transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.max(jobProgress, 8)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] text-[#6b7280] flex items-center justify-between pt-1">
            <span className="font-mono truncate max-w-[200px]">{fileName || `job: ${jobId.slice(0, 14)}`}</span>
            <span>Est. ~15-25s total</span>
          </div>

          <div className="pt-2 border-t border-[#e2ede5] flex justify-end">
            <button
              onClick={() => {
                setState("idle");
                setError("");
              }}
              className="text-xs text-[#6b7280] hover:text-[#111827] underline"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── View 3: Complete Executive Results (WhipScribe Dashboard Style) ── */
  if (state === "done" && analysis && transcript) {
    const ghIssues = generateGitHubIssues();
    const slackMsg = generateSlackDigest();

    return (
      <div className="min-h-screen bg-[#fafcf9] text-[#111827] pb-24">
        {/* Navigation Sticky Topbar */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e2ede5] px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-[#88d927] text-black font-black text-xs flex items-center justify-center">
                w
              </div>
              <span className="font-bold text-sm text-[#111827]">ShipNotes</span>
              <span className="text-gray-300">/</span>
              <span className="text-xs text-[#4b5563] font-medium truncate max-w-xs">
                {analysis.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadMarkdownReport}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1e4d35] hover:bg-[#183f2a] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <IconDownload />
                <span>Export .md</span>
              </button>
              <button
                onClick={() => {
                  setState("idle");
                  setTranscript(null);
                  setAnalysis(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-[#374151] hover:text-[#111827] bg-white hover:bg-[#f2f9f4] border border-[#d5e8da] rounded-lg transition-colors"
              >
                ← New Standup
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
          {/* Executive Header Box (WhipScribe Soft Mint Style) */}
          <div className="p-6 bg-[#f2f9f4] border border-[#d5e8da] rounded-2xl space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-[#d5e8da] text-[#1e4d35]">
                  {fmt(transcript.duration)} duration
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-[#d5e8da] text-[#1e4d35]">
                  {Object.keys(analysis.speakerMap).length} speakers
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-white border border-[#d5e8da] text-[#6b7280]">
                  target: {targetRepo}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#111827]">
                {analysis.title}
              </h1>
              <p className="text-[#374151] text-sm sm:text-base leading-relaxed max-w-3xl">
                {analysis.summary}
              </p>
            </div>

            {/* Bottom Controls: Speaker Renaming + Compact Audio Player */}
            <div className="pt-3 border-t border-[#d5e8da] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Speakers List */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-[#1e4d35] mr-1">
                  Speakers:
                </span>
                {Object.entries(analysis.speakerMap).map(([id, stats]) => (
                  <div
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#d5e8da] text-xs shadow-2xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1e4d35]" />
                    <input
                      className="bg-transparent border-b border-transparent hover:border-[#276244] focus:border-[#1e4d35] text-[#111827] font-medium focus:outline-none w-24 text-xs"
                      value={speakerNames[id] || (id === "Unknown" ? "Bama (Dev)" : id)}
                      placeholder={id}
                      onChange={(e) =>
                        setSpeakerNames((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                    />
                    <span className="text-[#6b7280] text-[11px]">({fmt(stats.totalTime)})</span>
                  </div>
                ))}
              </div>

              {/* Compact Inline Audio Player */}
              {audioUrl && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white border border-[#d5e8da] shrink-0 shadow-2xs">
                  <span className="text-xs font-semibold text-[#1e4d35] flex items-center gap-1">
                    <IconPlay className="w-3 h-3 text-[#1e4d35]" />
                    Audio
                  </span>
                  <audio ref={audioRef} src={audioUrl} controls className="h-6 w-44" />
                </div>
              )}
            </div>
          </div>

          {/* WhipScribe Underline Tabs (Matching "All files" / "Folders" in Image 1) */}
          <div className="flex border-b border-[#e2ede5] gap-6 text-sm">
            {(
              [
                { id: "actions", label: `Action Items & Blockers (${analysis.actionItems.length})` },
                { id: "github", label: `GitHub Issues (${ghIssues.length})` },
                { id: "slack", label: `Team Slack Digest` },
                { id: "transcript", label: `Diarized Transcript` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 transition-colors relative font-medium ${
                  activeTab === tab.id ? "text-[#1e4d35] font-semibold" : "text-[#6b7280] hover:text-[#111827]"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#1e4d35] rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Action Items & Blockers ── */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              {/* Shipped Items */}
              {analysis.shipped.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#1e4d35]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1e4d35]">
                      Shipped Yesterday
                    </span>
                  </div>
                  <div className="divide-y divide-[#e2ede5] border border-[#d5e8da] rounded-xl bg-white shadow-xs">
                    {analysis.shipped.map((item, i) => (
                      <div key={i} className="p-4 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-[#111827]">{item.description}</p>
                          <span className="text-xs text-[#6b7280]">
                            Owner: <strong className="text-[#111827]">{spk(item.speaker)}</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(item.timestamp))}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-[#edf7f0] hover:bg-[#d8ebde] border border-[#d5e8da] text-xs font-mono font-semibold text-[#1e4d35] transition-colors flex items-center gap-1.5"
                        >
                          <IconPlay className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#1e4d35]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1e4d35]">
                    Committed Action Items
                  </span>
                </div>
                <div className="divide-y divide-[#e2ede5] border border-[#d5e8da] rounded-xl bg-white shadow-xs">
                  {analysis.actionItems.map((item, i) => (
                    <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#6b7280]">#{i + 1}</span>
                          <span className="text-sm font-semibold text-[#111827]">{item.task}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-[#6b7280]">
                          <span>
                            Assignee: <strong className="text-[#111827]">@{spk(item.speaker)}</strong>
                          </span>
                          <span>·</span>
                          <span>Due: {item.deadline}</span>
                          <span>·</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                              item.priority === "high"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {item.priority}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => seekTo(parseTs(item.timestamp))}
                          className="px-2.5 py-1 rounded-lg bg-[#edf7f0] hover:bg-[#d8ebde] border border-[#d5e8da] text-xs font-mono font-semibold text-[#1e4d35] transition-colors flex items-center gap-1.5"
                        >
                          <IconPlay className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </button>
                        <a
                          href={ghIssues[i]?.prefillUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs font-semibold text-white bg-[#1e4d35] hover:bg-[#183f2a] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <span>Open on GitHub</span>
                          <IconExternal className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockers */}
              {analysis.blockers.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                      Identified Blockers
                    </span>
                  </div>
                  <div className="divide-y divide-red-200 border border-red-200 rounded-xl bg-red-50/50 shadow-xs">
                    {analysis.blockers.map((b, i) => (
                      <div key={i} className="p-4 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-red-900">{b.description}</p>
                          <div className="flex items-center gap-2 text-xs text-red-700">
                            <span>Blocked: @{spk(b.owner)}</span>
                            <span>·</span>
                            <span className="font-bold uppercase text-[10px] bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                              {b.severity}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(b.timestamp))}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 border border-red-300 text-xs font-mono font-bold text-red-700 transition-colors flex items-center gap-1"
                        >
                          <IconPlay className="w-2.5 h-2.5" />
                          <span>{b.timestamp}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {analysis.decisions.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                      Consensus Decisions
                    </span>
                  </div>
                  <div className="divide-y divide-amber-200 border border-amber-200 rounded-xl bg-amber-50/50 shadow-xs">
                    {analysis.decisions.map((d, i) => (
                      <div key={i} className="p-4 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-amber-950">{d.summary}</p>
                          <span className="text-xs text-amber-800">
                            Agreed by: <strong>{d.speakers.map(spk).join(", ")}</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(d.timestamp))}
                          className="shrink-0 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-xs font-mono font-bold text-amber-800 transition-colors flex items-center gap-1"
                        >
                          <IconPlay className="w-2.5 h-2.5" />
                          <span>{d.timestamp}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: GitHub Issues ── */}
          {activeTab === "github" && (
            <div className="space-y-4">
              <div className="p-4 bg-white border border-[#d5e8da] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1e4d35]">Target Repository:</span>
                  <input
                    type="text"
                    value={targetRepo}
                    onChange={(e) => setTargetRepo(e.target.value)}
                    className="px-2.5 py-1 bg-[#fafcf9] border border-[#d5e8da] rounded-lg text-xs font-mono text-[#111827] focus:outline-none focus:border-[#1e4d35] w-56 font-medium"
                  />
                </div>
                <button
                  onClick={() => {
                    const md = ghIssues
                      .map((issue) => `## ${issue.title}\n\n${issue.body}`)
                      .join("\n\n---\n\n");
                    copy(md, "all-gh");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-[#1e4d35] hover:text-white bg-[#edf7f0] hover:bg-[#1e4d35] border border-[#d5e8da] rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  {copiedId === "all-gh" ? <IconCheck /> : <IconCopy />}
                  <span>{copiedId === "all-gh" ? "Copied" : "Copy All Issues (.md)"}</span>
                </button>
              </div>

              <div className="space-y-3">
                {ghIssues.map((issue) => (
                  <div key={issue.id} className="p-4 bg-white border border-[#d5e8da] rounded-xl space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-mono text-[#6b7280]">Issue #{issue.id + 1}</span>
                        <h4 className="font-semibold text-[#111827] text-sm">{issue.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copy(issue.body, `gh-${issue.id}`)}
                          className="px-2.5 py-1 text-xs font-medium text-[#4b5563] hover:text-[#111827] bg-[#fafcf9] border border-[#d5e8da] rounded-lg transition-colors"
                        >
                          {copiedId === `gh-${issue.id}` ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={issue.prefillUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs font-semibold text-white bg-[#1e4d35] hover:bg-[#183f2a] rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <span>Open Issue</span>
                          <IconExternal className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <pre className="text-xs text-[#374151] font-mono bg-[#f4faf5] p-3.5 rounded-lg border border-[#d5e8da] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {issue.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 3: Team Slack Digest ── */}
          {activeTab === "slack" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#4b5563]">
                  Ready to copy and paste directly into your <strong>#standup</strong> channel:
                </span>
                <button
                  onClick={() => copy(slackMsg, "slack-digest")}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1e4d35] hover:bg-[#183f2a] rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  {copiedId === "slack-digest" ? <IconCheck /> : <IconCopy />}
                  <span>{copiedId === "slack-digest" ? "Copied" : "Copy Slack Digest"}</span>
                </button>
              </div>

              <div className="p-5 bg-white border border-[#d5e8da] rounded-xl font-mono text-xs leading-relaxed text-[#111827] whitespace-pre-wrap shadow-xs">
                {slackMsg}
              </div>
            </div>
          )}

          {/* ── TAB 4: Diarized Transcript ── */}
          {activeTab === "transcript" && (
            <div className="divide-y divide-[#e2ede5] border border-[#d5e8da] rounded-xl bg-white shadow-xs overflow-hidden">
              {transcript.segments.map((seg, i) => (
                <div
                  key={i}
                  onClick={() => seekTo(seg.start)}
                  className="p-4 hover:bg-[#f2f9f4] transition-colors cursor-pointer flex items-start gap-4"
                >
                  <span className="font-mono text-xs font-semibold text-[#1e4d35] shrink-0 w-14 pt-0.5">
                    {fmt(seg.start)}
                  </span>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-[#111827] bg-[#edf7f0] border border-[#d5e8da] px-2 py-0.5 rounded">
                      {spk(seg.speaker)}
                    </span>
                    <p className="text-sm text-[#374151] leading-relaxed pt-1">{seg.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
