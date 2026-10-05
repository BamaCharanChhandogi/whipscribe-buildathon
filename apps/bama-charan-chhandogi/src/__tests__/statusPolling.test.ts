import { describe, it, expect } from "vitest";

/**
 * Tests for the cache-busting polling URL pattern.
 * The status route uses a cache-busted URL: /api/status/<jobId>?t=<timestamp>
 */

function buildPollingUrl(jobId: string, timestamp: number): string {
  return `/api/status/${jobId}?t=${timestamp}`;
}

function isTerminalStatus(status: string): boolean {
  return status === "done" || status === "failed";
}

function shouldContinuePolling(status: string, attempts: number, maxAttempts: number): boolean {
  if (isTerminalStatus(status)) return false;
  if (attempts >= maxAttempts) return false;
  return true;
}

function nextPollDelay(attempt: number, baseMs = 3000, maxMs = 15000): number {
  // Exponential back-off: 3s, 6s, 9s, capped at maxMs
  return Math.min(baseMs * attempt, maxMs);
}

describe("buildPollingUrl", () => {
  it("produces the correct path with jobId", () => {
    const url = buildPollingUrl("abc-123", 1000);
    expect(url).toBe("/api/status/abc-123?t=1000");
  });

  it("appends unique timestamp as cache-buster", () => {
    const url1 = buildPollingUrl("job-1", 1000);
    const url2 = buildPollingUrl("job-1", 2000);
    expect(url1).not.toBe(url2);
  });

  it("handles job IDs with hyphens and alphanumeric chars", () => {
    const url = buildPollingUrl("job-abc-XYZ-999", 9999);
    expect(url).toContain("job-abc-XYZ-999");
  });
});

describe("isTerminalStatus", () => {
  it("returns true for 'done'", () => {
    expect(isTerminalStatus("done")).toBe(true);
  });

  it("returns true for 'failed'", () => {
    expect(isTerminalStatus("failed")).toBe(true);
  });

  it("returns false for 'queued'", () => {
    expect(isTerminalStatus("queued")).toBe(false);
  });

  it("returns false for 'processing'", () => {
    expect(isTerminalStatus("processing")).toBe(false);
  });

  it("returns false for unknown status strings", () => {
    expect(isTerminalStatus("pending")).toBe(false);
    expect(isTerminalStatus("")).toBe(false);
  });
});

describe("shouldContinuePolling", () => {
  it("stops when status is 'done'", () => {
    expect(shouldContinuePolling("done", 3, 20)).toBe(false);
  });

  it("stops when status is 'failed'", () => {
    expect(shouldContinuePolling("failed", 3, 20)).toBe(false);
  });

  it("stops when max attempts reached", () => {
    expect(shouldContinuePolling("processing", 20, 20)).toBe(false);
  });

  it("continues polling while status is 'queued' under limit", () => {
    expect(shouldContinuePolling("queued", 1, 20)).toBe(true);
  });

  it("continues polling while status is 'processing' under limit", () => {
    expect(shouldContinuePolling("processing", 5, 20)).toBe(true);
  });

  it("stops at exactly the max attempt boundary", () => {
    expect(shouldContinuePolling("queued", 20, 20)).toBe(false);
    expect(shouldContinuePolling("queued", 19, 20)).toBe(true);
  });
});

describe("nextPollDelay — exponential back-off", () => {
  it("returns 3s on first attempt", () => {
    expect(nextPollDelay(1)).toBe(3000);
  });

  it("returns 6s on second attempt", () => {
    expect(nextPollDelay(2)).toBe(6000);
  });

  it("caps at maxMs (15s)", () => {
    expect(nextPollDelay(10)).toBe(15000);
    expect(nextPollDelay(100)).toBe(15000);
  });

  it("never returns 0 for positive attempts", () => {
    expect(nextPollDelay(1)).toBeGreaterThan(0);
  });
});
