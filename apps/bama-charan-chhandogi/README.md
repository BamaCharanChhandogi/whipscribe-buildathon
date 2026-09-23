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
Standup Recording (.mp3/.wav/.m4a) / Live Browser Mic
        │
        ▼
┌──────────────────────────┐
│   WhipScribe API          │
│   diarize + word_timestamps│
│   POST /api/v1/transcribe │
│   Poll → GET /status/{id} │
│   Fetch → /result?json    │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│   Gemini 3.6 Flash AI     │
│   Structured extraction:  │
│   • Action items + owner  │
│   • Decisions + evidence  │
│   • Blockers + severity   │
│   • Shipped updates       │
└──────────┬───────────────┘
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
  GitHub  Slack  Interactive
  Issues  Digest Dashboard
```

## What's Built

- **WhipScribe GPU API Integration**: Direct multi-part audio file upload with GPU speaker diarization and word-level timestamps (`POST /api/v1/transcribe`).
- **In-Browser Voice Standup Recording**: Record live standups directly using the browser microphone with live audio waveform visualization and timer.
- **1-Click Evaluation Vector**: Pre-loaded 2-speaker engineering standup (`sample-standup.wav`) covering Clerk auth refactor, Stripe webhooks, and PostgreSQL migrations. Run through live WhipScribe API or test with 0s instant preview.
- **Gemini 3.6 Flash Intelligence**: Structured JSON extraction separating shipped work, action commitments, blockers with severity, and architectural decisions (equipped with 3x backoff retries and dual-layer fallback).
- **Direct 1-Click GitHub Issue Creator**: Click "Open on GitHub" on any action item to open a pre-filled new issue on GitHub with labels (`urgent`, `task`, `shipnotes`), assignees, and quoted audio evidence.
- **Interactive Transcript & Audio Sync**: Speaker-colored segments with click-to-seek audio playback.
- **Live Speaker Mapping UI**: Rename auto-detected `Speaker 0` and `Speaker 1` to real team members across the entire dashboard in real time.
- **Slack Digest Card**: Visual simulation of Slack mrkdwn digest ready to post to `#standup` with 1-click clipboard copy.
- **Export Standup Notes (.md)**: One-click export that downloads complete meeting notes and diarized dialogue as a clean Markdown report.
- **Developer-Centric UI**: Sharp Linear-inspired dark styling, crisp hairline borders, and zero AI clichés.

## What's Not Built (Honest)

- No OAuth for GitHub/Slack (issues and digests are 1-click URL pre-filled and clipboard copy-ready, not pushed via background bot daemon)
- No persistent database (stateless — processes one standup at a time for privacy and zero data retention)
- No batch processing or automated Google Meet bot integration

## Run Locally

```bash
cd apps/bama-charan-chhandogi
cp .env.example .env.local
# Add your WHIPSCRIBE_API_KEY and GEMINI_API_KEY to .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

- **Next.js 14** (App Router, serverless API routes)
- **TypeScript** (strict mode)
- **Tailwind CSS** (dark developer theme)
- **WhipScribe API** (transcription + diarization)
- **Google Gemini 3.6 Flash** (structured extraction)
- **Deployed on Vercel** (zero-config serverless)

## Builder

**Bama Charan Chhandogi**
- Portfolio: [bamacharan.com](https://bamacharan.com)
- GitHub: [BamaCharanChhandogi](https://github.com/BamaCharanChhandogi)
- LinkedIn: [bamacharanchhandogi](https://www.linkedin.com/in/bamacharanchhandogi/)

Currently building at ClipWise AI. Previously maintained TheAlgorithms (143K+ ⭐), shipped 3 VS Code extensions (3,000+ downloads), 2 npm packages (300+ downloads/month).
