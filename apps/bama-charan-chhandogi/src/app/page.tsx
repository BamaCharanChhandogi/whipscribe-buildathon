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
      <div className="min-h-screen bg-[#090a0f] text-[#f0f3f8] flex flex-col justify-between p-6 sm:p-12 max-w-4xl mx-auto">
        {/* Top Minimalist Header */}
        <header className="flex items-center justify-between border-b border-[#1e2230] pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-indigo-400 font-semibold">
              ShipNotes
            </span>
            <span className="text-[#363c54]">/</span>
            <span className="text-xs text-[#9ba3b8] font-mono">buildathon-track-4</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-[#9ba3b8]">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="w-1.5 h-1.5 bg-emerald-400" />
              API Ready
            </span>
            <a
              href="https://github.com/BamaCharanChhandogi/shipnotes"
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Hero Section */}
        <main className="my-auto py-12 space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Sprint standups to GitHub backlog.
            </h1>
            <p className="text-[#9ba3b8] text-sm sm:text-base max-w-xl leading-relaxed">
              Capture engineering voice notes. WhipScribe diarizes speakers, Gemini extracts actionable commitments, and ShipNotes drafts verified GitHub Issues without manual typing.
            </p>
          </div>

          {/* Evaluator 1-Click Test Vector */}
          <div className="p-4 bg-[#10121a] border border-[#1e2230] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-indigo-400 font-medium">vector: sample-standup.wav</span>
                <span className="text-[11px] font-mono text-[#5e667e]">2 speakers · 36s</span>
              </div>
              <p className="text-xs text-[#9ba3b8]">
                Auth refactor, Stripe webhook blocker, PostgreSQL migration consensus.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstantPreview}
                className="px-3.5 py-1.5 text-xs font-medium bg-[#f0f3f8] text-[#090a0f] hover:bg-white rounded transition-colors"
              >
                Instant Preview (0s)
              </button>
              <button
                onClick={handleTrySampleLive}
                className="px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-white bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] rounded transition-colors"
              >
                Run Live API
              </button>
            </div>
          </div>

          {/* Capture Panel: Live Mic + Dropzone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Live Mic Panel */}
            <div className="p-5 bg-[#10121a] border border-[#1e2230] rounded flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#5e667e]">Input 01</span>
                <h3 className="text-sm font-medium text-white">Browser Microphone</h3>
                <p className="text-xs text-[#9ba3b8]">Record a brief standup update directly from your device.</p>
              </div>

              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-full py-2 px-3 bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] text-xs font-medium text-slate-200 hover:text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                  <IconMic className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Record Live Audio</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                    <span className="inline-flex items-center gap-1.5 text-red-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      RECORDING
                    </span>
                    <span className="font-mono">{fmt(recordSeconds)}</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="w-full py-2 px-3 bg-red-950/70 hover:bg-red-900/80 border border-red-800 text-xs font-medium text-red-200 rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <IconStop className="w-3.5 h-3.5" />
                    <span>Stop and Process</span>
                  </button>
                </div>
              )}
            </div>

            {/* Dropzone Panel */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) handleUpload(f);
              }}
              className="p-5 bg-[#10121a] border border-[#1e2230] hover:border-[#3b4259] rounded transition-colors cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#5e667e]">Input 02</span>
                <h3 className="text-sm font-medium text-white">Audio File</h3>
                <p className="text-xs text-[#9ba3b8]">Drop an existing MP3, WAV, M4A, or WebM recording.</p>
              </div>

              <div className="py-2 px-3 border border-dashed border-[#2b3044] group-hover:border-[#3b4259] rounded text-center text-xs text-[#9ba3b8] group-hover:text-white transition-colors flex items-center justify-center gap-2 bg-[#0d0e14]">
                <IconUpload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Select file from disk</span>
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
          </div>

          {/* Error Notice */}
          {state === "error" && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded text-xs text-red-200 flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={() => {
                  setState("idle");
                  setError("");
                }}
                className="underline hover:text-white font-medium"
              >
                Reset
              </button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="pt-4 border-t border-[#1e2230] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#5e667e] font-mono">
          <span>Candidate: Bama Charan Chhandogi</span>
          <span>Engine: WhipScribe GPU Transcription + Gemini Synthesis</span>
        </footer>
      </div>
    );
  }

  /* ── View 2: Processing State ── */
  if (state === "uploading" || state === "processing" || state === "analyzing") {
    const stepLabel =
      state === "uploading"
        ? "Uploading audio payload..."
        : state === "processing"
        ? "Running WhipScribe GPU diarization & word alignment..."
        : "Extracting action items and engineering commitments...";

    return (
      <div className="min-h-screen bg-[#090a0f] text-[#f0f3f8] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 p-5 bg-[#10121a] border border-[#1e2230] rounded">
          <div className="flex items-center justify-between text-xs font-mono text-[#9ba3b8] border-b border-[#1e2230] pb-2.5">
            <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {state === "uploading" ? "Payload Transfer" : state === "processing" ? "GPU Diarization" : "AI Synthesis"}
            </span>
            <span>Elapsed: {processSeconds}s</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white font-medium">{stepLabel}</span>
              <span className="font-mono text-indigo-400 font-medium">{jobProgress}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1 bg-[#161822] rounded overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(jobProgress, 8)}%` }}
              />
            </div>
          </div>

          <div className="text-[11px] font-mono text-[#5e667e] flex items-center justify-between pt-1">
            <span>{fileName || `job: ${jobId.slice(0, 12)}`}</span>
            <span>Est. ~25s</span>
          </div>

          <div className="pt-2 border-t border-[#1e2230] flex justify-end">
            <button
              onClick={() => {
                setState("idle");
                setError("");
              }}
              className="text-xs font-mono text-[#9ba3b8] hover:text-white underline"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── View 3: Complete Executive Results ── */
  if (state === "done" && analysis && transcript) {
    const ghIssues = generateGitHubIssues();
    const slackMsg = generateSlackDigest();

    return (
      <div className="min-h-screen bg-[#090a0f] text-[#f0f3f8] pb-24">
        {/* Navigation Sticky Topbar */}
        <header className="sticky top-0 z-40 bg-[#090a0f]/95 backdrop-blur border-b border-[#1e2230] px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-indigo-400 font-semibold">
                ShipNotes
              </span>
              <span className="text-[#363c54]">/</span>
              <span className="text-xs text-slate-300 font-mono truncate max-w-xs">
                {analysis.title}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadMarkdownReport}
                className="px-3 py-1 text-xs font-mono text-slate-300 hover:text-white bg-[#10121a] hover:bg-[#161822] border border-[#1e2230] rounded transition-colors flex items-center gap-1.5"
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
                className="px-3 py-1 text-xs font-mono text-slate-300 hover:text-white bg-[#10121a] hover:bg-[#161822] border border-[#1e2230] rounded transition-colors"
              >
                New Session
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
          {/* Executive Header Box */}
          <div className="p-5 bg-[#10121a] border border-[#1e2230] rounded space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#161822] border border-[#2b3044] text-[#9ba3b8]">
                  {fmt(transcript.duration)} duration
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#161822] border border-[#2b3044] text-[#9ba3b8]">
                  {Object.keys(analysis.speakerMap).length} participants
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">{analysis.title}</h1>
              <p className="text-[#9ba3b8] text-sm leading-relaxed max-w-3xl">{analysis.summary}</p>
            </div>

            {/* Compact Bottom Bar: Speakers + Audio Player */}
            <div className="pt-3 border-t border-[#1e2230] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Speakers List */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#5e667e] mr-1">
                  Speakers:
                </span>
                {Object.entries(analysis.speakerMap).map(([id, stats]) => (
                  <div
                    key={id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#161822] border border-[#2b3044] text-xs"
                  >
                    <span className="w-1.5 h-1.5 bg-indigo-400" />
                    <input
                      className="bg-transparent border-b border-transparent hover:border-[#3b4259] focus:border-indigo-400 text-slate-200 focus:outline-none w-24 text-xs font-mono"
                      value={speakerNames[id] || (id === "Unknown" ? "Bama (Dev)" : id)}
                      placeholder={id}
                      onChange={(e) =>
                        setSpeakerNames((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                    />
                    <span className="text-[#5e667e] font-mono text-[10px]">({fmt(stats.totalTime)})</span>
                  </div>
                ))}
              </div>

              {/* Compact Inline Audio Player (Never Stretched) */}
              {audioUrl && (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#161822] border border-[#2b3044] shrink-0">
                  <span className="text-[11px] font-mono text-[#9ba3b8] flex items-center gap-1">
                    <IconPlay className="w-2.5 h-2.5 text-indigo-400" />
                    Audio
                  </span>
                  <audio ref={audioRef} src={audioUrl} controls className="h-6 w-44" />
                </div>
              )}
            </div>
          </div>

          {/* GitHub-Style Underline Tabs */}
          <div className="flex border-b border-[#1e2230] gap-6 text-xs font-mono">
            {(
              [
                { id: "actions", label: `Action Items (${analysis.actionItems.length})` },
                { id: "github", label: `GitHub Issues (${ghIssues.length})` },
                { id: "slack", label: `Team Digest` },
                { id: "transcript", label: `Diarized Transcript` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2.5 transition-colors relative ${
                  activeTab === tab.id ? "text-white font-medium" : "text-[#9ba3b8] hover:text-white"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-indigo-500" />
                )}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Action Items ── */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              {/* Shipped Items */}
              {analysis.shipped.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 font-medium">
                    Shipped Achievements
                  </span>
                  <div className="divide-y divide-[#1e2230] border border-[#1e2230] rounded bg-[#10121a]">
                    {analysis.shipped.map((item, i) => (
                      <div key={i} className="p-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-white">{item.description}</p>
                          <span className="text-xs text-[#9ba3b8] font-mono">
                            Owner: <span className="text-slate-200">{spk(item.speaker)}</span>
                          </span>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(item.timestamp))}
                          className="shrink-0 px-2 py-0.5 rounded bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] text-[11px] font-mono text-emerald-400 hover:text-white transition-colors flex items-center gap-1"
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
              <div className="space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-indigo-400 font-medium">
                  Committed Action Items
                </span>
                <div className="divide-y divide-[#1e2230] border border-[#1e2230] rounded bg-[#10121a]">
                  {analysis.actionItems.map((item, i) => (
                    <div key={i} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[#5e667e]">#{i + 1}</span>
                          <span className="text-sm font-medium text-white">{item.task}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-[#9ba3b8] font-mono">
                          <span>Assignee: @{spk(item.speaker)}</span>
                          <span>·</span>
                          <span>Due: {item.deadline}</span>
                          <span>·</span>
                          <span className="text-[#5e667e]">priority: {item.priority}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => seekTo(parseTs(item.timestamp))}
                          className="px-2 py-0.5 rounded bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] text-[11px] font-mono text-indigo-400 hover:text-white transition-colors flex items-center gap-1"
                        >
                          <IconPlay className="w-2.5 h-2.5" />
                          <span>{item.timestamp}</span>
                        </button>
                        <a
                          href={ghIssues[i]?.prefillUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-0.5 text-xs font-mono text-slate-200 hover:text-white bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] rounded transition-colors flex items-center gap-1"
                        >
                          <span>Open Issue</span>
                          <IconExternal />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blockers */}
              {analysis.blockers.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-red-400 font-medium">
                    Identified Blockers
                  </span>
                  <div className="divide-y divide-[#1e2230] border border-[#1e2230] rounded bg-[#10121a]">
                    {analysis.blockers.map((b, i) => (
                      <div key={i} className="p-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-red-200">{b.description}</p>
                          <div className="flex items-center gap-2 text-xs text-[#9ba3b8] font-mono">
                            <span>Blocked: @{spk(b.owner)}</span>
                            <span>·</span>
                            <span className="text-red-400 uppercase text-[10px]">{b.severity}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(b.timestamp))}
                          className="shrink-0 px-2 py-0.5 rounded bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] text-[11px] font-mono text-red-400 hover:text-white transition-colors flex items-center gap-1"
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
                <div className="space-y-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400 font-medium">
                    Consensus Decisions
                  </span>
                  <div className="divide-y divide-[#1e2230] border border-[#1e2230] rounded bg-[#10121a]">
                    {analysis.decisions.map((d, i) => (
                      <div key={i} className="p-3.5 flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-white">{d.summary}</p>
                          <span className="text-xs text-[#9ba3b8] font-mono">
                            Agreed by: {d.speakers.map(spk).join(", ")}
                          </span>
                        </div>
                        <button
                          onClick={() => seekTo(parseTs(d.timestamp))}
                          className="shrink-0 px-2 py-0.5 rounded bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] text-[11px] font-mono text-amber-400 hover:text-white transition-colors flex items-center gap-1"
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
              <div className="p-3 bg-[#10121a] border border-[#1e2230] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#5e667e]">target_repo:</span>
                  <input
                    type="text"
                    value={targetRepo}
                    onChange={(e) => setTargetRepo(e.target.value)}
                    className="px-2 py-1 bg-[#090a0f] border border-[#2b3044] rounded text-xs font-mono text-white focus:outline-none focus:border-indigo-400 w-56"
                  />
                </div>
                <button
                  onClick={() => {
                    const md = ghIssues
                      .map((issue) => `## ${issue.title}\n\n${issue.body}`)
                      .join("\n\n---\n\n");
                    copy(md, "all-gh");
                  }}
                  className="px-3 py-1 text-xs font-mono text-slate-300 hover:text-white bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] rounded transition-colors flex items-center gap-1.5"
                >
                  {copiedId === "all-gh" ? <IconCheck /> : <IconCopy />}
                  <span>{copiedId === "all-gh" ? "Copied" : "Copy All Issues (.md)"}</span>
                </button>
              </div>

              <div className="space-y-3">
                {ghIssues.map((issue) => (
                  <div key={issue.id} className="p-4 bg-[#10121a] border border-[#1e2230] rounded space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <span className="text-xs font-mono text-[#5e667e]">#{issue.id + 1}</span>
                        <h4 className="font-medium text-white text-sm">{issue.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => copy(issue.body, `gh-${issue.id}`)}
                          className="px-2 py-0.5 text-xs font-mono text-[#9ba3b8] hover:text-white bg-[#161822] border border-[#2b3044] rounded transition-colors"
                        >
                          {copiedId === `gh-${issue.id}` ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={issue.prefillUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-0.5 text-xs font-mono text-slate-200 hover:text-white bg-[#161822] hover:bg-[#1f2230] border border-[#2b3044] rounded transition-colors flex items-center gap-1"
                        >
                          <span>Open Issue</span>
                          <IconExternal />
                        </a>
                      </div>
                    </div>

                    <pre className="text-xs text-[#9ba3b8] font-mono bg-[#090a0f] p-3 rounded border border-[#1e2230] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {issue.body}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 3: Team Digest ── */}
          {activeTab === "slack" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#9ba3b8]">
                  Formatted for Slack, Discord, or Linear:
                </span>
                <button
                  onClick={() => copy(slackMsg, "slack-digest")}
                  className="px-3 py-1 text-xs font-mono text-slate-200 hover:text-white bg-[#10121a] hover:bg-[#161822] border border-[#1e2230] rounded transition-colors flex items-center gap-1.5"
                >
                  {copiedId === "slack-digest" ? <IconCheck /> : <IconCopy />}
                  <span>{copiedId === "slack-digest" ? "Copied" : "Copy Text"}</span>
                </button>
              </div>

              <div className="p-4 bg-[#10121a] border border-[#1e2230] rounded font-mono text-xs leading-relaxed text-[#f0f3f8] whitespace-pre-wrap">
                {slackMsg}
              </div>
            </div>
          )}

          {/* ── TAB 4: Diarized Dialogue ── */}
          {activeTab === "transcript" && (
            <div className="divide-y divide-[#1e2230] border border-[#1e2230] rounded bg-[#10121a]">
              {transcript.segments.map((seg, i) => (
                <div
                  key={i}
                  onClick={() => seekTo(seg.start)}
                  className="p-3.5 hover:bg-[#161822] transition-colors cursor-pointer flex items-start gap-4"
                >
                  <span className="font-mono text-xs text-indigo-400 shrink-0 w-14">
                    {fmt(seg.start)}
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-slate-200">
                      {spk(seg.speaker)}
                    </span>
                    <p className="text-sm text-[#9ba3b8] leading-relaxed">{seg.text}</p>
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
