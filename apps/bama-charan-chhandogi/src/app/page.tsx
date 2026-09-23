"use client";

import { useState, useRef, useCallback } from "react";

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

/* ───────── Main Component ───────── */
export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [activeTab, setActiveTab] = useState<"actions" | "transcript" | "github" | "slack">("actions");
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  /* ── Upload file ── */
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

  /* ── Poll job status ── */
  const pollJob = useCallback(async (id: string) => {
    const maxAttempts = 120; // 10 min max
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
          throw new Error("Transcription failed — WhipScribe could not process the audio");
        }
        if (job.locked) {
          throw new Error("Transcript locked — insufficient credits");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Polling error");
        setState("error");
        return;
      }
    }
    setError("Timeout — transcription took too long");
    setState("error");
  }, []);

  /* ── Fetch transcript + AI analysis ── */
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

  /* ── Seek audio to timestamp ── */
  const seekTo = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
    }
  };

  /* ── Parse MM:SS to seconds ── */
  const parseTs = (ts: string): number => {
    const [m, s] = ts.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  };

  /* ── Speaker display name ── */
  const spk = (id: string) => speakerNames[id] || id;
  const spkColor = (id: string) => {
    const n = parseInt(id.replace(/\D/g, "") || "0");
    return SPEAKER_COLORS[n % SPEAKER_COLORS.length];
  };

  /* ── GitHub Issues markdown ── */
  const generateGitHubIssues = () => {
    if (!analysis) return [];
    return analysis.actionItems.map((item, i) => ({
      title: `[ShipNotes] ${item.task}`,
      body: `## Action Item from Standup\n\n**Assigned to:** ${spk(item.speaker)}\n**Priority:** ${item.priority}\n**Deadline:** ${item.deadline}\n**Evidence:** [${item.timestamp}] in standup recording\n\n> Extracted automatically by [ShipNotes](https://github.com/BamaCharanChhandogi) from WhipScribe transcript.\n\n**Job ID:** \`${jobId}\``,
      labels: [item.priority === "high" ? "urgent" : "task", "shipnotes"],
      assignee: spk(item.speaker),
      id: i,
    }));
  };

  /* ── Slack message format ── */
  const generateSlackDigest = () => {
    if (!analysis) return "";
    const lines = [
      `📋 *${analysis.title}*`,
      analysis.summary,
      "",
      `*🚀 Shipped (${analysis.shipped.length})*`,
      ...analysis.shipped.map((s) => `• ${s.description} — _${spk(s.speaker)}_`),
      "",
      `*📌 Action Items (${analysis.actionItems.length})*`,
      ...analysis.actionItems.map(
        (a) => `• ${a.priority === "high" ? "🔴" : a.priority === "medium" ? "🟡" : "🟢"} ${a.task} → _${spk(a.speaker)}_ (${a.deadline})`
      ),
      "",
    ];
    if (analysis.blockers.length) {
      lines.push(
        `*🚧 Blockers (${analysis.blockers.length})*`,
        ...analysis.blockers.map((b) => `• ${b.severity === "critical" ? "🔴" : "🟠"} ${b.description} — _${spk(b.owner)}_`),
        ""
      );
    }
    if (analysis.decisions.length) {
      lines.push(
        `*✅ Decisions (${analysis.decisions.length})*`,
        ...analysis.decisions.map((d) => `• ${d.summary}`),
        ""
      );
    }
    lines.push("_Generated by ShipNotes · Powered by WhipScribe_");
    return lines.join("\n");
  };

  /* ── Copy to clipboard ── */
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  /* ─────────────────── RENDER ─────────────────── */

  /* ── Idle: Upload UI ── */
  if (state === "idle" || state === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-xl">📋</div>
            <h1 className="text-4xl font-bold tracking-tight">ShipNotes</h1>
          </div>
          <p className="text-zinc-400 text-lg max-w-md">
            Record your sprint standup. Get GitHub Issues, a Slack digest, and a team changelog — automatically.
          </p>
          <p className="text-zinc-600 text-sm mt-2">Powered by WhipScribe API · Built by Bama Charan Chhandogi</p>
        </div>

        {/* Upload zone */}
        <div
          className="w-full max-w-lg border-2 border-dashed border-zinc-700 hover:border-green-500/50 rounded-xl p-12 text-center cursor-pointer transition-colors"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleUpload(f);
          }}
        >
          <div className="text-4xl mb-4">🎙️</div>
          <p className="text-zinc-300 font-medium mb-1">Drop your standup recording here</p>
          <p className="text-zinc-500 text-sm">MP3, WAV, M4A, MP4, WebM — up to 10 min</p>
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

        {state === "error" && (
          <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 max-w-lg w-full">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              className="mt-3 text-sm underline text-red-300"
              onClick={() => { setState("idle"); setError(""); }}
            >
              Try again
            </button>
          </div>
        )}

        {/* How it works */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-4 gap-4 max-w-2xl w-full">
          {[
            { icon: "🎙️", label: "Record", desc: "Upload standup" },
            { icon: "⚡", label: "Transcribe", desc: "WhipScribe API" },
            { icon: "🧠", label: "Extract", desc: "Gemini AI" },
            { icon: "🚀", label: "Ship", desc: "GitHub + Slack" },
          ].map((s) => (
            <div key={s.label} className="text-center p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="text-2xl mb-2">{s.icon}</div>
              <p className="text-sm font-medium text-zinc-300">{s.label}</p>
              <p className="text-xs text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Processing states ── */
  if (state === "uploading" || state === "processing" || state === "analyzing") {
    const step =
      state === "uploading" ? { icon: "📤", text: "Uploading to WhipScribe...", sub: fileName }
      : state === "processing" ? { icon: "⚡", text: "WhipScribe is transcribing...", sub: `Job: ${jobId.slice(0, 8)}...` }
      : { icon: "🧠", text: "Gemini is extracting insights...", sub: "Action items, decisions, blockers" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-6 pulse-dot">{step.icon}</div>
          <p className="text-xl font-medium text-zinc-200">{step.text}</p>
          <p className="text-zinc-500 text-sm mt-2">{step.sub}</p>
          {state === "processing" && (
            <div className="mt-8 flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500 pulse-dot" />
              <p className="text-xs text-zinc-500">Polling every 3s — typically 30-90s for short recordings</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Results dashboard ── */
  if (state === "done" && analysis && transcript) {
    const ghIssues = generateGitHubIssues();
    const slackMsg = generateSlackDigest();

    return (
      <div className="min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur border-b border-zinc-800 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <span className="font-semibold">ShipNotes</span>
              <span className="text-zinc-600 text-sm">/ {analysis.title}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-500">{fmt(transcript.duration)} recording</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500">{Object.keys(analysis.speakerMap).length} speakers</span>
              <span className="text-zinc-700">|</span>
              <span className="text-green-500 font-medium">{analysis.actionItems.length} action items</span>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-6">
          {/* Summary card */}
          <div className="mb-6 p-5 rounded-xl bg-zinc-900 border border-zinc-800">
            <h2 className="text-xl font-bold mb-2">{analysis.title}</h2>
            <p className="text-zinc-400">{analysis.summary}</p>

            {/* Speaker legend */}
            <div className="mt-4 flex flex-wrap gap-3">
              {Object.entries(analysis.speakerMap).map(([id, stats]) => (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 rounded-full" style={{ background: spkColor(id) }} />
                  <input
                    className="bg-transparent border-b border-zinc-700 text-zinc-300 w-28 text-sm focus:outline-none focus:border-green-500"
                    placeholder={id}
                    value={speakerNames[id] || ""}
                    onChange={(e) => setSpeakerNames((prev) => ({ ...prev, [id]: e.target.value }))}
                  />
                  <span className="text-zinc-600">{fmt(stats.totalTime)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audio player */}
          {audioUrl && (
            <div className="mb-6">
              <audio ref={audioRef} src={audioUrl} controls className="w-full rounded-lg" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-zinc-900 rounded-lg w-fit">
            {(["actions", "transcript", "github", "slack"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab === "actions" ? `📌 Actions (${analysis.actionItems.length})`
                  : tab === "transcript" ? `📝 Transcript (${transcript.segments.length})`
                  : tab === "github" ? `🐙 GitHub Issues (${ghIssues.length})`
                  : `💬 Slack Digest`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              {/* Shipped */}
              {analysis.shipped.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">🚀 Shipped</h3>
                  <div className="space-y-2">
                    {analysis.shipped.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <button onClick={() => seekTo(parseTs(s.timestamp))} className="text-xs text-green-400 font-mono hover:underline shrink-0 mt-0.5">
                          {s.timestamp}
                        </button>
                        <div>
                          <p className="text-zinc-200">{s.description}</p>
                          <p className="text-xs mt-1" style={{ color: spkColor(s.speaker) }}>{spk(s.speaker)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Items */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">📌 Action Items</h3>
                <div className="space-y-2">
                  {analysis.actionItems.map((a, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                      <button onClick={() => seekTo(parseTs(a.timestamp))} className="text-xs text-blue-400 font-mono hover:underline shrink-0 mt-0.5">
                        {a.timestamp}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            a.priority === "high" ? "bg-red-500/20 text-red-400"
                            : a.priority === "medium" ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-green-500/20 text-green-400"
                          }`}>
                            {a.priority}
                          </span>
                          <p className="text-zinc-200">{a.task}</p>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-zinc-500">
                          <span style={{ color: spkColor(a.speaker) }}>{spk(a.speaker)}</span>
                          <span>Due: {a.deadline}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {analysis.actionItems.length === 0 && (
                    <p className="text-zinc-600 text-sm">No action items extracted from this recording.</p>
                  )}
                </div>
              </div>

              {/* Blockers */}
              {analysis.blockers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">🚧 Blockers</h3>
                  <div className="space-y-2">
                    {analysis.blockers.map((b, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <button onClick={() => seekTo(parseTs(b.timestamp))} className="text-xs text-red-400 font-mono hover:underline shrink-0 mt-0.5">
                          {b.timestamp}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              b.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"
                            }`}>
                              {b.severity}
                            </span>
                            <p className="text-zinc-200">{b.description}</p>
                          </div>
                          <p className="text-xs mt-1" style={{ color: spkColor(b.owner) }}>{spk(b.owner)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Decisions */}
              {analysis.decisions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">✅ Decisions</h3>
                  <div className="space-y-2">
                    {analysis.decisions.map((d, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                        <button onClick={() => seekTo(parseTs(d.timestamp))} className="text-xs text-purple-400 font-mono hover:underline shrink-0 mt-0.5">
                          {d.timestamp}
                        </button>
                        <div>
                          <p className="text-zinc-200">{d.summary}</p>
                          <p className="text-xs text-zinc-500 mt-1">{d.speakers.map(spk).join(", ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "transcript" && (
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2">
              {transcript.segments.map((seg, i) => {
                const n = parseInt(seg.speaker.replace(/\D/g, "") || "0");
                return (
                  <div
                    key={i}
                    className={`p-3 rounded-lg cursor-pointer hover:brightness-125 transition-all speaker-bg-${n % 6}`}
                    onClick={() => seekTo(seg.start)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500">{fmt(seg.start)}</span>
                      <span className="text-xs font-semibold" style={{ color: spkColor(seg.speaker) }}>
                        {spk(seg.speaker)}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">{seg.text}</p>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "github" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-400">
                  {ghIssues.length} issues ready to create from action items
                </p>
                <button
                  onClick={() => {
                    const md = ghIssues.map((issue) => `## ${issue.title}\n\n${issue.body}`).join("\n\n---\n\n");
                    copy(md);
                  }}
                  className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  📋 Copy All as Markdown
                </button>
              </div>
              {ghIssues.map((issue) => (
                <div key={issue.id} className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-green-500">●</span>
                        <h4 className="font-medium text-zinc-200">{issue.title}</h4>
                      </div>
                      <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono bg-zinc-950 p-3 rounded-lg mt-2">
                        {issue.body}
                      </pre>
                      <div className="flex gap-2 mt-3">
                        {issue.labels.map((l) => (
                          <span key={l} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">{l}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => copy(issue.body)}
                      className="shrink-0 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === "slack" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-zinc-400">Slack digest preview — ready to post</p>
                <button
                  onClick={() => copy(slackMsg)}
                  className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  📋 Copy Digest
                </button>
              </div>
              {/* Slack preview */}
              <div className="rounded-xl bg-white text-gray-900 p-5 border border-gray-200 shadow-lg">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-white text-sm font-bold">S</div>
                  <div>
                    <span className="font-bold text-sm">ShipNotes Bot</span>
                    <span className="text-xs text-gray-400 ml-2">APP</span>
                  </div>
                </div>
                <div className="pl-10 text-sm leading-relaxed whitespace-pre-wrap font-[Lato,sans-serif]">
                  {slackMsg.split("\n").map((line, i) => {
                    // Bold markers
                    const boldParts = line.split(/\*([^*]+)\*/g);
                    return (
                      <div key={i} className={line === "" ? "h-2" : ""}>
                        {boldParts.map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-zinc-800 text-center text-xs text-zinc-600">
            <p>ShipNotes · Built by <a href="https://bamacharan.com" target="_blank" className="text-zinc-400 hover:text-white">Bama Charan Chhandogi</a> · Powered by <a href="https://whipscribe.com" target="_blank" className="text-zinc-400 hover:text-white">WhipScribe API</a></p>
            <p className="mt-1">WhipScribe Buildathon 2026 · Track 4: Audio Intelligence Workflow</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
