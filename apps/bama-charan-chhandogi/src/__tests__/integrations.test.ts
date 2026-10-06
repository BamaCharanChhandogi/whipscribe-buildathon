import { describe, it, expect } from "vitest";

function buildGitHubPayload(
  title: string,
  body: string,
  labels: string[] = ["shipnotes", "task"]
) {
  return {
    title: title.trim(),
    body: body || "",
    labels,
  };
}

function buildSlackBlocksPayload(title: string, digestText: string) {
  return {
    text: title ? `🚢 *${title}* — Sprint Standup Digest\n\n${digestText}` : digestText,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚢 ${title || "Sprint Standup Digest"}`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: digestText,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Generated automatically by *ShipNotes* · Powered by WhipScribe GPU Audio Diarization",
          },
        ],
      },
    ],
  };
}

describe("GitHub Direct Integration Payload", () => {
  it("formats GitHub issue payload with title and body", () => {
    const payload = buildGitHubPayload("[ShipNotes] Fix auth bug", "Assignee: @Alex");
    expect(payload.title).toBe("[ShipNotes] Fix auth bug");
    expect(payload.body).toBe("Assignee: @Alex");
    expect(payload.labels).toEqual(["shipnotes", "task"]);
  });

  it("handles custom priority labels", () => {
    const payload = buildGitHubPayload("Fix bug", "Details", ["urgent", "bug"]);
    expect(payload.labels).toContain("urgent");
    expect(payload.labels).toContain("bug");
  });

  it("trims whitespace from issue title", () => {
    const payload = buildGitHubPayload("   [ShipNotes] Update docs   ", "Body");
    expect(payload.title).toBe("[ShipNotes] Update docs");
  });
});

describe("Slack Direct Webhook Payload", () => {
  it("creates valid Slack Block Kit structure", () => {
    const payload = buildSlackBlocksPayload("Sprint Sync", "*Shipped:* Auth service");
    expect(payload.blocks).toHaveLength(3);
    expect(payload.blocks[0].type).toBe("header");
    expect(payload.blocks[1].type).toBe("section");
    expect(payload.blocks[2].type).toBe("context");
  });

  it("includes fallback notification text with title", () => {
    const payload = buildSlackBlocksPayload("Sprint Standup", "Summary text");
    expect(payload.text).toContain("Sprint Standup");
    expect(payload.text).toContain("Summary text");
  });

  it("sets context signature mentioning ShipNotes and WhipScribe", () => {
    const payload = buildSlackBlocksPayload("Title", "Body");
    const contextText = (payload.blocks[2] as any).elements[0].text;
    expect(contextText).toContain("ShipNotes");
    expect(contextText).toContain("WhipScribe");
  });
});

describe("Validation Rules", () => {
  it("validates GitHub repo format owner/repo", () => {
    const isValidRepo = (repo: string) => Boolean(repo && repo.includes("/") && repo.split("/").length === 2 && repo.split("/")[0].length > 0 && repo.split("/")[1].length > 0);
    expect(isValidRepo("BamaCharanChhandogi/shipnotes")).toBe(true);
    expect(isValidRepo("invalid-repo")).toBe(false);
    expect(isValidRepo("")).toBe(false);
  });

  it("validates Slack webhook URL format", () => {
    const isValidSlackWebhook = (url: string) => Boolean(url && url.startsWith("https://hooks.slack.com/services/"));
    expect(isValidSlackWebhook("https://hooks.slack.com/services/T01/B02/xyz")).toBe(true);
    expect(isValidSlackWebhook("https://discord.com/api/webhooks")).toBe(false);
    expect(isValidSlackWebhook("")).toBe(false);
  });
});
