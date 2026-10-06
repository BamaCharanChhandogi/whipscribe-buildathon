import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl: clientWebhookUrl, digestText, title } = await req.json();

    const webhookUrl = clientWebhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith("https://hooks.slack.com/")) {
      return NextResponse.json(
        { error: "Valid Slack Webhook URL is required. Set SLACK_WEBHOOK_URL in env or pass webhookUrl in request." },
        { status: 400 }
      );
    }

    if (!digestText) {
      return NextResponse.json(
        { error: "Digest text content is required." },
        { status: 400 }
      );
    }

    const payload = {
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

    const response = await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Slack Webhook error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully posted digest to Slack channel!",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error posting to Slack" },
      { status: 500 }
    );
  }
}
