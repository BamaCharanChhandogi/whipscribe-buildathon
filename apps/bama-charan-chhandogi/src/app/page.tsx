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

const SPEAKER_COLORS = ["#60a5fa", "#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#fb923c"];
const fmt = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/* ───────── Pre-loaded Sample Vector for Instant 0s Preview ───────── */
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
    "Speaker 0 shipped the Clerk authentication refactor and committed to unblocking Speaker 1 by pinging Alex for Stripe API test keys. The team agreed on an architectural migration to PostgreSQL over MongoDB, with Speaker 1 owning Drizzle schema migrations due tomorrow.",
  actionItems: [
    {
      speaker: "Speaker 0",
      task: "Ping Alex to provision Stripe API test keys",
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
  const [activeTab, setActiveTab] = useState<"actions" | "transcript" | "github" | "slack">("actions");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({
    "Speaker 0": "Alex (Lead Dev)",
    "Speaker 1": "Sarah (Backend)",
  });
  const [targetRepo, setTargetRepo] = useState<string>("BamaCharanChhandogi/shipnotes");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Audio & mic recording states */
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /* ── Recording Timer ── */
  useEffect(() => {
    if (isRecording) {
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  /* ── Upload & Process File ── */
  const handleUpload = useCallback(async (file: File) => {
    setState("uploading");
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
      setState("processing");
      pollJob(data.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setState("error");
    }
  }, []);

  /* ── Poll WhipScribe Status ── */
  const pollJob = useCallback(async (id: string) => {
    const maxAttempts = 120; // 6 mins max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(`/api/status/${id}`);
        const job = await res.json();
        if (job.status === "done") {
          setState("analyzing");
          await runAnalysis(id);
          return;
        }
        if (job.status === "failed") {
          throw new Error("Transcription failed — WhipScribe engine could not process audio.");
        }
        if (job.locked) {
          throw new Error("Transcript locked — insufficient audio credits.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Polling error");
        setState("error");
        return;
      }
    }
    setError("Timeout — transcription exceeded 6 minutes.");
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

  /* ── Live In-Browser Microphone Recording ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `live_standup_${Date.now()}.webm`, {
          type: "audio/webm",
        });
        stream.getTracks().forEach((track) => track.stop());
        handleUpload(audioFile);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setError("");
    } catch (err) {
      setError(
        "Microphone access denied or unavailable. Please grant permission or upload an audio file."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /* ── 1-Click Evaluation Vector: Live API Process ── */
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
    } catch (e) {
      setError("Failed to load sample audio file.");
      setState("error");
    }
  };

  /* ── 1-Click Instant Preview (0s Wait) ── */
  const handleInstantPreview = () => {
    setFileName("sample-standup.wav");
    setAudioUrl("/sample-standup.wav");
    setJobId("preview-vector-sprint-sync");
    setTranscript(SAMPLE_TRANSCRIPT);
    setAnalysis(SAMPLE_ANALYSIS);
    setSpeakerNames({
      "Speaker 0": "Alex (Lead Dev)",
      "Speaker 1": "Sarah (Backend)",
    });
    setState("done");
  };

  /* ── Seek Audio to Timestamp ── */
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

  const spk = (id: string) => speakerNames[id] || id;
  const spkColor = (id: string) => {
    const n = parseInt(id.replace(/\D/g, "") || "0");
    return SPEAKER_COLORS[n % SPEAKER_COLORS.length];
  };

  /* ── Copy to Clipboard Helper ── */
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ── GitHub Issues Generator ── */
  const generateGitHubIssues = () => {
    if (!analysis) return [];
    return analysis.actionItems.map((item, i) => {
      const issueTitle = `[ShipNotes] ${item.task}`;
      const issueBody = `### 📋 Action Item from Sprint Standup\n\n- **Assignee:** @${spk(item.speaker)}\n- **Priority:** ${item.priority.toUpperCase()}\n- **Deadline:** ${item.deadline}\n- **Timestamp Evidence:** \`[${item.timestamp}]\` in recording\n\n> Extracted automatically by [ShipNotes](https://github.com/BamaCharanChhandogi/shipnotes) using WhipScribe API.\n\n*Audio Job ID: \`${jobId}\`*`;
      const labels = [item.priority === "high" ? "urgent" : "task", "shipnotes"];

      // Pre-fill URL for 1-click issue creation
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
      `📋 *${analysis.title}*`,
      analysis.summary,
      "",
      `*🚀 Shipped (${analysis.shipped.length})*`,
      ...analysis.shipped.map((s) => `• ${s.description} — _${spk(s.speaker)}_ (\`${s.timestamp}\`)`),
      "",
      `*📌 Action Items (${analysis.actionItems.length})*`,
      ...analysis.actionItems.map(
        (a) =>
          `• ${a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "🟢"} *${a.task}* → _${spk(
            a.speaker
          )}_ (Due: ${a.deadline}) [${a.timestamp}]`
      ),
      "",
    ];
    if (analysis.blockers.length) {
      lines.push(
        `*🚧 Blockers (${analysis.blockers.length})*`,
        ...analysis.blockers.map(
          (b) => `• ${b.severity === "critical" ? "🔴" : "🟠"} ${b.description} — _${spk(b.owner)}_`
        ),
        ""
      );
    }
    if (analysis.decisions.length) {
      lines.push(
        `*✅ Decisions (${analysis.decisions.length})*`,
        ...analysis.decisions.map((d) => `• ${d.summary} (\`${d.timestamp}\`)`),
        ""
      );
    }
    lines.push("_Generated automatically by ShipNotes · Powered by WhipScribe API_");
    return lines.join("\n");
  };

  /* ── Download Standup Markdown Notes ── */
  const downloadMarkdownReport = () => {
    if (!analysis || !transcript) return;
    const content = `# ${analysis.title}
*Recorded duration: ${fmt(transcript.duration)} | Extracted via ShipNotes & WhipScribe API*

## Executive Summary
${analysis.summary}

## 🚀 Shipped
${analysis.shipped.map((s) => `- **${s.description}** (${spk(s.speaker)} at \`${s.timestamp}\`)`).join("\n")}

## 📌 Action Items
${analysis.actionItems
  .map(
    (a) =>
      `- [ ] **${a.task}** | Owner: @${spk(a.speaker)} | Priority: \`${a.priority}\` | Due: ${a.deadline} | Evidence: \`[${a.timestamp}]\``
  )
  .join("\n")}

## 🚧 Blockers
${analysis.blockers
  .map((b) => `- ⚠️ **${b.description}** (Owner: ${spk(b.owner)} | Severity: ${b.severity})`)
  .join("\n")}

## ✅ Decisions
${analysis.decisions.map((d) => `- **${d.summary}** (Agreed by: ${d.speakers.map(spk).join(", ")})`).join("\n")}

---
### Full Diarized Transcript
${transcript.segments.map((s) => `**[${fmt(s.start)}] ${spk(s.speaker)}:** ${s.text}`).join("\n\n")}
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `standup-notes-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─────────────────── RENDER ─────────────────── */

  /* ── View 1: Idle & Upload State ── */
  if (state === "idle" || state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
        {/* Top Announcement Badge */}
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          WhipScribe Buildathon Track 4 Submission
        </div>

        {/* Header */}
        <div className="text-center mb-8 max-w-xl">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/40 flex items-center justify-center text-2xl shadow-lg shadow-green-500/10">
              📋
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              Ship<span className="text-green-500">Notes</span>
            </h1>
          </div>
          <p className="text-zinc-300 text-base sm:text-lg leading-relaxed">
            Transform sprint standup audio into structured <strong className="text-white">GitHub Issues</strong> and <strong className="text-white">Slack digests</strong> in seconds.
          </p>
          <p className="text-zinc-500 text-xs sm:text-sm mt-2">
            Automated Voice-to-Backlog pipeline powered by WhipScribe GPU Transcription
          </p>
        </div>

        {/* 1-Click Evaluation Hero Card */}
        <div className="w-full max-w-xl mb-6 p-4 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-green-950/40 border border-green-500/30 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <span className="text-sm font-semibold text-white">Evaluator 1-Click Demo</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 font-mono">
              Zero Upload Required
            </span>
          </div>
          <p className="text-xs text-zinc-400 mb-3">
            2-engineer sprint standup covering Auth shipping, Stripe webhook blockers, and PostgreSQL migration.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleInstantPreview}
              className="flex-1 px-4 py-2 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>🚀</span> Instant Interactive Preview (0s)
            </button>
            <button
              onClick={handleTrySampleLive}
              className="flex-1 px-4 py-2 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-1.5"
            >
              <span>⚡</span> Run Sample via Live WhipScribe API
            </button>
          </div>
        </div>

        {/* Primary Input Container (Live Mic or Dropzone) */}
        <div className="w-full max-w-xl bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 backdrop-blur shadow-2xl">
          {/* In-Browser Live Microphone Recorder */}
          <div className="mb-6 p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm font-medium text-zinc-300">Live Voice Standup</span>
              {isRecording && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  REC {fmt(recordSeconds)}
                </span>
              )}
            </div>

            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full py-3 px-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span>Record Live Standup via Mic</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-center items-center gap-1 h-6">
                  <div className="w-1 bg-red-500 h-3 animate-pulse" />
                  <div className="w-1 bg-red-500 h-6 animate-pulse" />
                  <div className="w-1 bg-red-500 h-4 animate-pulse" />
                  <div className="w-1 bg-red-500 h-5 animate-pulse" />
                  <div className="w-1 bg-red-500 h-2 animate-pulse" />
                </div>
                <button
                  onClick={stopRecording}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-all shadow-lg shadow-red-500/20"
                >
                  ⏹ Stop & Process with WhipScribe
                </button>
              </div>
            )}
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-zinc-800" />
            <span className="flex-shrink mx-4 text-xs font-mono text-zinc-600 uppercase">OR UPLOAD AUDIO</span>
            <div className="flex-grow border-t border-zinc-800" />
          </div>

          {/* Drag & Drop Area */}
          <div
            className="mt-4 border-2 border-dashed border-zinc-700 hover:border-green-500/60 rounded-xl p-8 text-center cursor-pointer transition-all bg-zinc-950/40 hover:bg-zinc-950/80"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleUpload(f);
            }}
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-zinc-200 text-sm font-medium">Drop an existing recording here</p>
            <p className="text-zinc-500 text-xs mt-1">MP3, WAV, M4A, MP4, WebM (up to 10 min)</p>
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

        {/* Error Notification */}
        {state === "error" && (
          <div className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 max-w-xl w-full text-center">
            <p className="font-semibold text-sm">Processing Error</p>
            <p className="text-xs mt-1">{error}</p>
            <button
              className="mt-3 text-xs font-semibold px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded text-red-200"
              onClick={() => {
                setState("idle");
                setError("");
              }}
            >
              Reset & Try Again
            </button>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 text-center text-xs text-zinc-600">
          <p>
            Built by{" "}
            <a href="https://bamacharan.com" target="_blank" className="text-zinc-400 hover:underline">
              Bama Charan Chhandogi
            </a>{" "}
            for the WhipScribe Buildathon ·{" "}
            <a
              href="https://github.com/BamaCharanChhandogi/shipnotes"
              target="_blank"
              className="text-zinc-400 hover:underline"
            >
              GitHub Source
            </a>
          </p>
        </div>
      </div>
    );
  }

  /* ── View 2: Progress & Processing States ── */
  if (state === "uploading" || state === "processing" || state === "analyzing") {
    const step =
      state === "uploading"
        ? { icon: "📤", title: "Uploading Standup Audio...", sub: fileName }
        : state === "processing"
        ? {
            icon: "⚡",
            title: "WhipScribe GPU Transcription & Diarization...",
            sub: `Active Job ID: ${jobId.slice(0, 12)}...`,
          }
        : {
            icon: "🧠",
            title: "Gemini 3.6 Flash Intelligence Synthesis...",
            sub: "Extracting action items, blockers, decisions & shipped commits",
          };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0a0a]">
        <div className="text-center max-w-md p-8 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-2xl">
          <div className="text-6xl mb-6 animate-bounce">{step.icon}</div>
          <h3 className="text-lg font-bold text-white">{step.title}</h3>
          <p className="text-zinc-400 text-xs font-mono mt-2">{step.sub}</p>

          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping" />
            <span className="text-xs text-zinc-500">Live GPU Pipeline Active</span>
          </div>
        </div>
      </div>
    );
  }

  /* ── View 3: Complete Results Dashboard ── */
  if (state === "done" && analysis && transcript) {
    const ghIssues = generateGitHubIssues();
    const slackMsg = generateSlackDigest();

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 pb-16">
        {/* Navigation Sticky Topbar */}
        <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/80 px-6 py-3">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <span className="font-bold text-white tracking-tight">ShipNotes</span>
              <span className="text-zinc-600 text-sm hidden sm:inline">/</span>
              <span className="text-zinc-400 text-xs sm:text-sm font-medium truncate max-w-xs">
                {analysis.title}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={downloadMarkdownReport}
                className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg transition-all flex items-center gap-1.5"
              >
                <span>📥</span> Export Notes (.md)
              </button>
              <button
                onClick={() => {
                  setState("idle");
                  setTranscript(null);
                  setAnalysis(null);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded-lg transition-all"
              >
                + New Standup
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Executive Standup Briefing Card */}
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{analysis.title}</h1>
                <p className="text-zinc-400 text-sm mt-1">{analysis.summary}</p>
              </div>
              <div className="shrink-0 flex items-center gap-3 text-xs font-mono text-zinc-400">
                <span className="px-2.5 py-1 rounded bg-zinc-800">⏱ {fmt(transcript.duration)}</span>
                <span className="px-2.5 py-1 rounded bg-zinc-800">👥 {Object.keys(analysis.speakerMap).length} Speakers</span>
              </div>
            </div>

            {/* Interactive Speaker Name Mapping */}
            <div>
              <p className="text-xs uppercase tracking-wider font-semibold text-zinc-500 mb-2">
                Identified Speakers (Edit names live)
              </p>
              <div className="flex flex-wrap gap-3">
                {Object.entries(analysis.speakerMap).map(([id, stats]) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: spkColor(id) }} />
                    <input
                      className="bg-transparent border-b border-zinc-700 focus:border-green-500 text-zinc-200 focus:outline-none w-28 text-xs font-medium"
                      placeholder={id}
                      value={speakerNames[id] || ""}
                      onChange={(e) =>
                        setSpeakerNames((prev) => ({ ...prev, [id]: e.target.value }))
                      }
                    />
                    <span className="text-zinc-500 font-mono">({fmt(stats.totalTime)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Synchronized Audio Player */}
          {audioUrl && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
              <span className="text-xs font-medium text-zinc-400 shrink-0 flex items-center gap-1.5">
                <span>🔊</span> Synchronized Recording:
              </span>
              <audio ref={audioRef} src={audioUrl} controls className="w-full h-9 rounded-lg" />
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-zinc-800 pb-1 overflow-x-auto">
            {(
              [
                { id: "actions", label: `📌 Actions & Highlights (${analysis.actionItems.length})` },
                { id: "github", label: `🐙 GitHub Issues (${ghIssues.length})` },
                { id: "slack", label: `💬 Slack Digest` },
                { id: "transcript", label: `📝 Diarized Transcript (${transcript.segments.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-green-600 text-white shadow-lg shadow-green-600/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB 1: Actions, Blockers, Shipped, Decisions ── */}
          {activeTab === "actions" && (
            <div className="space-y-6">
              {/* Shipped Highlights */}
              {analysis.shipped.length > 0 && (
                <div className="p-5 rounded-2xl bg-green-950/20 border border-green-500/20">
                  <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🚀</span> Shipped Since Last Standup
                  </h3>
                  <div className="space-y-2">
                    {analysis.shipped.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => seekTo(parseTs(item.timestamp))}
                            className="text-xs font-mono text-green-400 hover:underline px-2 py-0.5 rounded bg-green-500/10 shrink-0 mt-0.5"
                          >
                            ▶ {item.timestamp}
                          </button>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{item.description}</p>
                            <p className="text-xs text-zinc-500 mt-1">
                              Shipped by: <span style={{ color: spkColor(item.speaker) }}>{spk(item.speaker)}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items List */}
              <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>📌</span> Action Items & Commitments
                </h3>
                <div className="space-y-3">
                  {analysis.actionItems.map((item, i) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-all"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() => seekTo(parseTs(item.timestamp))}
                          className="text-xs font-mono text-blue-400 hover:underline px-2 py-0.5 rounded bg-blue-500/10 shrink-0 mt-0.5"
                        >
                          ▶ {item.timestamp}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                item.priority === "high"
                                  ? "bg-red-500/20 text-red-400"
                                  : item.priority === "medium"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-green-500/20 text-green-400"
                              }`}
                            >
                              {item.priority}
                            </span>
                            <span className="text-sm font-medium text-white">{item.task}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-zinc-400">
                            <span>
                              Owner:{" "}
                              <strong style={{ color: spkColor(item.speaker) }}>{spk(item.speaker)}</strong>
                            </span>
                            <span>Due: {item.deadline}</span>
                          </div>
                        </div>
                      </div>

                      {/* 1-Click Action to create on GitHub */}
                      <a
                        href={ghIssues[i]?.prefillUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 transition-all flex items-center gap-1"
                      >
                        <span>🐙</span> Create Issue
                      </a>
                    </div>
                  ))}
                  {analysis.actionItems.length === 0 && (
                    <p className="text-xs text-zinc-500">No action items detected in this standup.</p>
                  )}
                </div>
              </div>

              {/* Blockers */}
              {analysis.blockers.length > 0 && (
                <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/20">
                  <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>🚧</span> Blockers Raised
                  </h3>
                  <div className="space-y-2">
                    {analysis.blockers.map((b, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => seekTo(parseTs(b.timestamp))}
                            className="text-xs font-mono text-red-400 hover:underline px-2 py-0.5 rounded bg-red-500/10 shrink-0 mt-0.5"
                          >
                            ▶ {b.timestamp}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-300 uppercase">
                                {b.severity}
                              </span>
                              <p className="text-sm font-medium text-zinc-200">{b.description}</p>
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">
                              Blocked team member:{" "}
                              <strong style={{ color: spkColor(b.owner) }}>{spk(b.owner)}</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {analysis.decisions.length > 0 && (
                <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/20">
                  <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span>✅</span> Architectural Decisions Agreed
                  </h3>
                  <div className="space-y-2">
                    {analysis.decisions.map((d, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800"
                      >
                        <button
                          onClick={() => seekTo(parseTs(d.timestamp))}
                          className="text-xs font-mono text-purple-400 hover:underline px-2 py-0.5 rounded bg-purple-500/10 shrink-0 mt-0.5"
                        >
                          ▶ {d.timestamp}
                        </button>
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{d.summary}</p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Agreed by: {d.speakers.map(spk).join(", ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: GitHub Issues Generator ── */}
          {activeTab === "github" && (
            <div className="space-y-6">
              {/* Repository Target Selector */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Target GitHub Repository:</span>
                  <input
                    type="text"
                    value={targetRepo}
                    onChange={(e) => setTargetRepo(e.target.value)}
                    placeholder="owner/repository"
                    className="px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-green-500 w-64"
                  />
                </div>
                <button
                  onClick={() => {
                    const md = ghIssues
                      .map((issue) => `## ${issue.title}\n\n${issue.body}`)
                      .join("\n\n---\n\n");
                    copy(md, "all-gh");
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-200 transition-all flex items-center gap-1.5"
                >
                  <span>{copiedId === "all-gh" ? "✓ Copied!" : "📋"}</span>
                  <span>Copy All Issues as Markdown</span>
                </button>
              </div>

              {/* Issues List */}
              <div className="space-y-4">
                {ghIssues.map((issue) => (
                  <div key={issue.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <h4 className="font-bold text-white text-sm sm:text-base">{issue.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copy(issue.body, `gh-${issue.id}`)}
                          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-all"
                        >
                          {copiedId === `gh-${issue.id}` ? "✓ Copied" : "Copy Body"}
                        </button>
                        <a
                          href={issue.prefillUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-500 text-white transition-all shadow-md flex items-center gap-1"
                        >
                          <span>🚀</span> Open on GitHub
                        </a>
                      </div>
                    </div>

                    <pre className="text-xs text-zinc-300 font-mono bg-zinc-950 p-4 rounded-xl border border-zinc-800/80 overflow-x-auto whitespace-pre-wrap">
                      {issue.body}
                    </pre>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">Labels:</span>
                      {issue.labels.map((l) => (
                        <span
                          key={l}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB 3: Slack Digest ── */}
          {activeTab === "slack" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">
                  Formatted for Slack `#standup` or `#engineering` channel with mrkdwn syntax:
                </p>
                <button
                  onClick={() => copy(slackMsg, "slack-digest")}
                  className="px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all flex items-center gap-1"
                >
                  <span>{copiedId === "slack-digest" ? "✓ Copied to Clipboard!" : "📋"}</span>
                  <span>Copy Slack Digest</span>
                </button>
              </div>

              {/* Visual Slack Card Simulation */}
              <div className="rounded-2xl bg-[#1a1d21] border border-zinc-800 p-6 shadow-2xl text-zinc-100">
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-800">
                  <div className="w-9 h-9 rounded-lg bg-green-600 flex items-center justify-center text-white font-bold text-sm">
                    S
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">ShipNotes Bot</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                        APP
                      </span>
                    </div>
                    <span className="text-xs text-zinc-500">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="pl-12 text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {slackMsg.split("\n").map((line, i) => {
                    const boldParts = line.split(/\*([^*]+)\*/g);
                    return (
                      <div key={i} className={line === "" ? "h-2" : ""}>
                        {boldParts.map((part, j) =>
                          j % 2 === 1 ? (
                            <strong key={j} className="text-white font-semibold">
                              {part}
                            </strong>
                          ) : (
                            <span key={j} className="text-zinc-300">
                              {part}
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 4: Diarized Transcript ── */}
          {activeTab === "transcript" && (
            <div className="space-y-3 max-h-[650px] overflow-y-auto pr-2">
              <p className="text-xs text-zinc-500 mb-2">
                Click any dialogue line to seek audio playback to that exact timestamp:
              </p>
              {transcript.segments.map((seg, i) => {
                const n = parseInt(seg.speaker.replace(/\D/g, "") || "0");
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-xl cursor-pointer hover:brightness-125 transition-all speaker-bg-${
                      n % 6
                    } bg-zinc-900 border border-zinc-800`}
                    onClick={() => seekTo(seg.start)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold" style={{ color: spkColor(seg.speaker) }}>
                        {spk(seg.speaker)}
                      </span>
                      <span className="text-xs font-mono text-zinc-500 hover:text-green-400">
                        ▶ {fmt(seg.start)} - {fmt(seg.end)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{seg.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  return null;
}
