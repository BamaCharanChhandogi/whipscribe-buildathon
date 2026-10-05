import { describe, it, expect } from "vitest";

// Speaker name resolution logic mirroring page.tsx
function resolveSpeakerName(
  speakerId: string,
  speakerNames: Record<string, string>
): string {
  return speakerNames[speakerId] ?? speakerId;
}

function buildSpeakerMap(
  segments: Array<{ speaker: string; start: number; end: number }>
): Record<string, { totalTime: number; segments: number }> {
  const map: Record<string, { totalTime: number; segments: number }> = {};
  for (const seg of segments) {
    if (!map[seg.speaker]) {
      map[seg.speaker] = { totalTime: 0, segments: 0 };
    }
    map[seg.speaker].totalTime += seg.end - seg.start;
    map[seg.speaker].segments += 1;
  }
  return map;
}

describe("resolveSpeakerName", () => {
  it("returns the custom name when mapped", () => {
    expect(resolveSpeakerName("Speaker 0", { "Speaker 0": "Bama" })).toBe("Bama");
  });

  it("returns the raw ID when no mapping exists", () => {
    expect(resolveSpeakerName("Speaker 1", {})).toBe("Speaker 1");
  });

  it("returns mapped name even when other speakers are unmapped", () => {
    const names = { "Speaker 0": "Alice" };
    expect(resolveSpeakerName("Speaker 0", names)).toBe("Alice");
    expect(resolveSpeakerName("Speaker 1", names)).toBe("Speaker 1");
  });

  it("handles numeric-like speaker IDs", () => {
    expect(resolveSpeakerName("0", { "0": "Host" })).toBe("Host");
  });
});

describe("buildSpeakerMap", () => {
  const segments = [
    { speaker: "Speaker 0", start: 0, end: 10 },
    { speaker: "Speaker 1", start: 10, end: 25 },
    { speaker: "Speaker 0", start: 25, end: 40 },
  ];

  it("counts segments per speaker correctly", () => {
    const map = buildSpeakerMap(segments);
    expect(map["Speaker 0"].segments).toBe(2);
    expect(map["Speaker 1"].segments).toBe(1);
  });

  it("accumulates totalTime correctly", () => {
    const map = buildSpeakerMap(segments);
    expect(map["Speaker 0"].totalTime).toBe(25); // (10-0) + (40-25)
    expect(map["Speaker 1"].totalTime).toBe(15); // (25-10)
  });

  it("returns empty map for empty segments", () => {
    expect(buildSpeakerMap([])).toEqual({});
  });

  it("handles a single speaker with one segment", () => {
    const map = buildSpeakerMap([{ speaker: "Speaker 0", start: 5, end: 20 }]);
    expect(map["Speaker 0"]).toEqual({ totalTime: 15, segments: 1 });
  });

  it("correctly identifies unique speakers", () => {
    const map = buildSpeakerMap(segments);
    expect(Object.keys(map)).toHaveLength(2);
  });
});
