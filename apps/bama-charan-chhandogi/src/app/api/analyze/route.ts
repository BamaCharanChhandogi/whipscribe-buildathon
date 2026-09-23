import { NextRequest, NextResponse } from "next/server";
import { getTranscript } from "@/lib/whipscribe";
import { analyzeStandup } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    // Fetch transcript from WhipScribe
    const transcript = await getTranscript(jobId);

    // Run Gemini extraction
    const analysis = await analyzeStandup(transcript);

    return NextResponse.json({
      transcript,
      analysis,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analyze error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
