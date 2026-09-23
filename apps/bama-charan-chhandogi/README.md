# ShipNotes

**Sprint standup recordings → GitHub Issues + Slack digests, powered by WhipScribe.**

Record a 5-minute standup. ShipNotes transcribes it with speaker diarization via WhipScribe API, extracts action items / decisions / blockers / shipped updates via Gemini AI, and outputs them as ready-to-create GitHub Issues and a formatted Slack digest.

## Live Demo

🔗 **[https://shipnotes-inky.vercel.app](https://shipnotes-inky.vercel.app)** *(Zero install, running live on Vercel)*

## The Problem

Engineering teams record standups every day. Nobody processes them. Action items get lost, decisions go undocumented, blockers stay invisible until standup the next day.

Current tools push everything into Airtable or spreadsheets — tools developers don't actually use day-to-day. ShipNotes sends output where developers already live: **GitHub Issues** and **Slack**.

## How It Works

```
Standup Recording (.mp3/.wav/.m4a)
        │
        ▼
┌──────────────────────────┐
│   WhipScribe API          │
│   diarize + word_timestamps│
│   POST /api/v1/transcribe │
│   Poll → GET /jobs/{id}   │
│   Fetch → /result?json    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│   Gemini 2.0 Flash        │
│   Structured extraction:  │
│   • Action items + owner  │
│   • Decisions + evidence  │
│   • Blockers + severity   │
│   • Shipped updates       │
└──────────┬───────────────┘
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
  GitHub  Slack  Dashboard
  Issues  Digest (transcript
                  + audio sync)
```

## What's Built

- **WhipScribe API integration**: File upload with diarization and word-level timestamps
- **Job polling**: 3-second interval with 10-minute timeout, handles locked/failed states
- **Gemini AI extraction**: Structured JSON output (action items, decisions, blockers, shipped)
- **Interactive transcript**: Speaker-colored segments with click-to-seek audio sync
- **Speaker rename**: Map `Speaker 0` → real team member names
- **GitHub Issues output**: Pre-formatted issues with priority labels, assignees, and timestamp evidence
- **Slack digest output**: Copy-ready Slack message with emoji markers and ownership
- **Audio player**: Synchronized playback with timestamp-linked seeking
- **4-tab dashboard**: Actions, Transcript, GitHub Issues, Slack Digest

## What's Not Built (Honest)

- No OAuth for GitHub/Slack (issues are copy-ready, not auto-pushed)
- No persistent storage (stateless, process one standup at a time)
- No batch processing
- No webhook listener for automated triggering

## Run Locally

```bash
cd apps/bama-charan-chhandogi
cp .env.example .env.local
# Fill in WHIPSCRIBE_API_KEY and GEMINI_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 14** (App Router, serverless API routes)
- **TypeScript** (strict mode)
- **Tailwind CSS** (dark theme)
- **WhipScribe API** (transcription + diarization)
- **Google Gemini 2.0 Flash** (structured extraction)
- **Deployed on Vercel** (zero-config)

## Builder

**Bama Charan Chhandogi**
- Portfolio: [bamacharan.com](https://bamacharan.com)
- GitHub: [BamaCharanChhandogi](https://github.com/BamaCharanChhandogi)
- LinkedIn: [bamacharanchhandogi](https://www.linkedin.com/in/bamacharanchhandogi/)

Currently building at ClipWise AI. Previously maintained TheAlgorithms (143K+ ⭐), shipped 3 VS Code extensions (3,000+ downloads), 2 npm packages (300+ downloads/month).
