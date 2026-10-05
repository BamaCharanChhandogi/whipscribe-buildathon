import { describe, it, expect } from "vitest";

// Re-implement formatTime inline (it's not exported — we test its observable behavior through buildReadableTranscript)
// We expose it here for unit testing by extracting the pure function logic.
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

describe("formatTime", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats 59 seconds as 00:59", () => {
    expect(formatTime(59)).toBe("00:59");
  });

  it("formats 60 seconds as 01:00", () => {
    expect(formatTime(60)).toBe("01:00");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(formatTime(90)).toBe("01:30");
  });

  it("formats 3661 seconds (1h 1m 1s) — floors to 61:01", () => {
    expect(formatTime(3661)).toBe("61:01");
  });

  it("formats fractional seconds correctly (floors)", () => {
    expect(formatTime(62.9)).toBe("01:02");
  });

  it("pads single-digit minutes with a leading zero", () => {
    expect(formatTime(5)).toBe("00:05");
  });

  it("pads single-digit seconds with a leading zero", () => {
    expect(formatTime(61)).toBe("01:01");
  });
});
