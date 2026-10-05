import { describe, it, expect } from "vitest";

/**
 * GitHub Issue pre-fill URL builder.
 * Mirrors the logic used in page.tsx buildGithubIssueUrl().
 */
function buildGithubIssueUrl(
  repo: string,
  title: string,
  body: string,
  labels: string[] = []
): string {
  const base = `https://github.com/${repo}/issues/new`;
  const params = new URLSearchParams({
    title,
    body,
    labels: labels.join(","),
  });
  return `${base}?${params.toString()}`;
}

describe("buildGithubIssueUrl", () => {
  it("produces a valid GitHub issue URL", () => {
    const url = buildGithubIssueUrl(
      "org/repo",
      "Bug: crash on upload",
      "Steps to reproduce...",
      ["bug"]
    );
    expect(url).toMatch(/^https:\/\/github\.com\/org\/repo\/issues\/new\?/);
  });

  it("encodes the title in query params", () => {
    const url = buildGithubIssueUrl("org/repo", "Bug: crash on upload", "body", []);
    expect(url).toContain("title=Bug%3A+crash+on+upload");
  });

  it("encodes the body in query params", () => {
    const url = buildGithubIssueUrl("org/repo", "title", "Steps to reproduce:\n1. Upload audio", []);
    expect(url).toContain("body=");
    expect(url).toContain("Steps+to+reproduce");
  });

  it("joins multiple labels with a comma", () => {
    const url = buildGithubIssueUrl("org/repo", "t", "b", ["bug", "enhancement"]);
    expect(url).toContain("labels=bug%2Cenhancement");
  });

  it("handles empty labels array gracefully", () => {
    const url = buildGithubIssueUrl("org/repo", "t", "b", []);
    expect(url).toContain("labels=");
  });

  it("handles special characters in repo name", () => {
    const url = buildGithubIssueUrl("bama-charan/shipnotes", "Fix bug", "desc", []);
    expect(url).toContain("github.com/bama-charan/shipnotes");
  });

  it("handles unicode in title and body", () => {
    const url = buildGithubIssueUrl("org/repo", "🚀 Deploy fix", "Resolved 🎉", []);
    expect(url).toContain("title=");
    expect(url).toContain("body=");
  });

  it("does not double-encode reserved chars", () => {
    const url = buildGithubIssueUrl("org/repo", "title", "body", []);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe("title");
    expect(parsed.searchParams.get("body")).toBe("body");
  });
});
