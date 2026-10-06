import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { repo, title, body, labels, token: clientToken } = await req.json();

    const token = clientToken || process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GitHub Personal Access Token is required. Set GITHUB_TOKEN in env or pass token in request." },
        { status: 400 }
      );
    }

    const targetRepo = repo || process.env.GITHUB_REPO || "BamaCharanChhandogi/shipnotes";
    if (!targetRepo || !targetRepo.includes("/")) {
      return NextResponse.json(
        { error: "Valid target repository (owner/repo) is required." },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: "Issue title is required." },
        { status: 400 }
      );
    }

    const cleanToken = token.trim();
    const cleanRepo = targetRepo.trim();

    const response = await fetch(`https://api.github.com/repos/${cleanRepo}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${cleanToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ShipNotes-AudioIntelligence",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body: body || "",
        labels: labels || ["shipnotes", "task"],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `GitHub API error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      issueNumber: data.number,
      issueUrl: data.html_url,
      title: data.title,
      repo: cleanRepo,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error creating GitHub issue" },
      { status: 500 }
    );
  }
}
