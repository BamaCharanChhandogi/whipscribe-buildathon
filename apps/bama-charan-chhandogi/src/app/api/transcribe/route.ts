import { NextRequest, NextResponse } from "next/server";
import { submitFile, submitUrl } from "@/lib/whipscribe";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // File upload
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const job = await submitFile(file);
      return NextResponse.json(job);
    }

    if (contentType.includes("application/json")) {
      // URL submission
      const body = await req.json();
      const { url } = body;
      if (!url) {
        return NextResponse.json({ error: "No URL provided" }, { status: 400 });
      }
      const job = await submitUrl(url);
      return NextResponse.json(job);
    }

    return NextResponse.json(
      { error: "Invalid content type" },
      { status: 400 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Transcribe error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
