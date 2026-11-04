import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { audioExtension, compareDurations, formatBytes, safeDisplayName } from "@/lib/audio/voiceover";
import { readAudioDuration } from "@/lib/audio/duration";

/** Minimal PCM WAV: 8 kHz, mono, 16-bit. */
function wav(seconds: number): Buffer {
  const rate = 8000, data = rate * 2 * seconds;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data, 40);
  return Buffer.concat([h, Buffer.alloc(data)]);
}

describe("voiceover helpers", () => {
  it("accepts the four allowed extensions, case-insensitively", () => {
    for (const n of ["a.mp3", "a.WAV", "a.m4a", "a.aac"]) expect(audioExtension(n)).not.toBeNull();
  });
  it("rejects other types", () => {
    expect(audioExtension("a.ogg")).toBeNull();
    expect(audioExtension("noextension")).toBeNull();
  });
  it("strips paths and control characters from display names", () => {
    expect(safeDisplayName("..\\..\\evil/voice\u0000.mp3")).toBe("voice.mp3");
  });
  it("formats sizes", () => expect(formatBytes(1536)).toBe("1.5 KB"));
});

describe("compareDurations", () => {
  it("reports an 8% longer voiceover", () => {
    const c = compareDurations(100, 108);
    expect(c.percent).toBeCloseTo(8);
    expect(c.direction).toBe("longer");
    expect(c.withinTolerance).toBe(false);
  });
  it("treats differences within 3 seconds as matching", () => expect(compareDurations(100, 102.5).withinTolerance).toBe(true));
  it("detects shorter voiceovers", () => expect(compareDurations(100, 90).direction).toBe("shorter"));
});

describe("readAudioDuration", () => {
  it("reads the real duration of a WAV file", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vs-"));
    try {
      const file = path.join(dir, "t.wav");
      await writeFile(file, wav(2));
      expect(await readAudioDuration(file)).toBeCloseTo(2, 1);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("rejects files that are not audio", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vs-"));
    try {
      const file = path.join(dir, "bad.mp3");
      await writeFile(file, "this is not audio");
      await expect(readAudioDuration(file).then((d) => (d == null ? Promise.reject(new Error("null")) : d))).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
