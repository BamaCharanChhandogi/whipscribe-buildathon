import { describe, it, expect } from "vitest";
import type { StandupAnalysis, ActionItem, Blocker, ShipUpdate } from "../lib/gemini";

// ----- Helpers that mirror the markdown generation logic in page.tsx -----

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function generateMarkdownReport(analysis: StandupAnalysis, speakerNames: Record<string, string>): string {
  const resolveName = (id: string) => speakerNames[id] ?? id;

  let md = `# ${analysis.title}\n\n`;
  md += `## Summary\n${analysis.summary}\n\n`;

  if (analysis.shipped.length > 0) {
    md += `## ✅ Shipped\n`;
    analysis.shipped.forEach((s: ShipUpdate) => {
      md += `- **${resolveName(s.speaker)}** [${s.timestamp}]: ${s.description}\n`;
    });
    md += "\n";
  }

  if (analysis.blockers.length > 0) {
    md += `## 🚧 Blockers\n`;
    analysis.blockers.forEach((b: Blocker) => {
      md += `- [${b.severity.toUpperCase()}] **${resolveName(b.owner)}** [${b.timestamp}]: ${b.description}\n`;
    });
    md += "\n";
  }

  if (analysis.actionItems.length > 0) {
    md += `## 📋 Action Items\n`;
    analysis.actionItems.forEach((a: ActionItem) => {
      md += `- **${resolveName(a.speaker)}** — ${a.task} _(due: ${a.deadline})_ [${a.priority}]\n`;
    });
    md += "\n";
  }

  if (analysis.decisions.length > 0) {
    md += `## 🔑 Decisions\n`;
    analysis.decisions.forEach((d) => {
      md += `- [${d.timestamp}] ${d.summary} _(${d.speakers.map(resolveName).join(", ")})_\n`;
    });
    md += "\n";
  }

  md += `## 🎙️ Speaker Stats\n`;
  Object.entries(analysis.speakerMap).forEach(([id, stats]) => {
    md += `- **${resolveName(id)}**: ${Math.round(stats.totalTime)}s across ${stats.segments} segment(s)\n`;
  });

  return md;
}

// ----- Fixtures -----

const sampleAnalysis: StandupAnalysis = {
  title: "Weekly Engineering Standup",
  summary: "Team synced on Auth PR, staging blocker, and sprint goals.",
  actionItems: [
    {
      speaker: "Speaker 0",
      task: "Request staging keys from DevOps",
      deadline: "today",
      timestamp: "01:10",
      priority: "high",
    },
  ],
  decisions: [
    {
      summary: "Agreed to migrate to App Router",
      timestamp: "02:30",
      speakers: ["Speaker 0", "Speaker 1"],
    },
  ],
  blockers: [
    {
      description: "Waiting on staging API keys",
      owner: "Speaker 0",
      timestamp: "01:05",
      severity: "critical",
    },
  ],
  shipped: [
    {
      description: "Shipped Auth PR to production",
      speaker: "Speaker 1",
      timestamp: "00:30",
    },
  ],
  speakerMap: {
    "Speaker 0": { totalTime: 90, segments: 3 },
    "Speaker 1": { totalTime: 60, segments: 2 },
  },
};

const noNames: Record<string, string> = {};
const withNames: Record<string, string> = { "Speaker 0": "Bama", "Speaker 1": "Priya" };

// ----- Tests -----

describe("generateMarkdownReport", () => {
  it("starts with the meeting title as an H1", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toMatch(/^# Weekly Engineering Standup/);
  });

  it("includes the summary section", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## Summary");
    expect(md).toContain("Team synced on Auth PR");
  });

  it("includes Shipped section", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## ✅ Shipped");
    expect(md).toContain("Shipped Auth PR to production");
  });

  it("includes Blockers section with severity", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## 🚧 Blockers");
    expect(md).toContain("CRITICAL");
    expect(md).toContain("Waiting on staging API keys");
  });

  it("includes Action Items section with deadline", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## 📋 Action Items");
    expect(md).toContain("Request staging keys from DevOps");
    expect(md).toContain("due: today");
    expect(md).toContain("[high]");
  });

  it("includes Decisions section", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## 🔑 Decisions");
    expect(md).toContain("Agreed to migrate to App Router");
    expect(md).toContain("[02:30]");
  });

  it("includes Speaker Stats", () => {
    const md = generateMarkdownReport(sampleAnalysis, noNames);
    expect(md).toContain("## 🎙️ Speaker Stats");
    expect(md).toContain("90s across 3 segment(s)");
    expect(md).toContain("60s across 2 segment(s)");
  });

  it("resolves speaker names when mapping is provided", () => {
    const md = generateMarkdownReport(sampleAnalysis, withNames);
    expect(md).toContain("Bama");
    expect(md).toContain("Priya");
    expect(md).not.toContain("Speaker 0");
    expect(md).not.toContain("Speaker 1");
  });

  it("falls back to speaker ID when name not in map", () => {
    const partialNames: Record<string, string> = { "Speaker 0": "Bama" };
    const md = generateMarkdownReport(sampleAnalysis, partialNames);
    expect(md).toContain("Bama");
    expect(md).toContain("Speaker 1"); // not in map → keep raw ID
  });

  it("omits Shipped section if no shipped items", () => {
    const noShipped: StandupAnalysis = { ...sampleAnalysis, shipped: [] };
    const md = generateMarkdownReport(noShipped, noNames);
    expect(md).not.toContain("✅ Shipped");
  });

  it("omits Blockers section if no blockers", () => {
    const noBlockers: StandupAnalysis = { ...sampleAnalysis, blockers: [] };
    const md = generateMarkdownReport(noBlockers, noNames);
    expect(md).not.toContain("🚧 Blockers");
  });

  it("omits Action Items section if no action items", () => {
    const noActions: StandupAnalysis = { ...sampleAnalysis, actionItems: [] };
    const md = generateMarkdownReport(noActions, noNames);
    expect(md).not.toContain("📋 Action Items");
  });

  it("omits Decisions section if no decisions", () => {
    const noDecisions: StandupAnalysis = { ...sampleAnalysis, decisions: [] };
    const md = generateMarkdownReport(noDecisions, noNames);
    expect(md).not.toContain("🔑 Decisions");
  });
});
