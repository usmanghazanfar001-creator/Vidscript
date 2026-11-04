import { describe, expect, it } from "vitest";
import { declaredLanguage, detectScript, parseCaptions, validateCues } from "@/lib/captions/parse";
import { CAPTION_PRESETS, captionStyleForPreset } from "@/lib/captions/presets";
import { captionStyleSchema } from "@/remotion/schemas/vidscriptSchema";

const srt = (blocks: string[]) => blocks.map((b, i) => `${i + 1}\n${b}`).join("\n\n") + "\n";
const good = srt(["00:00:00,000 --> 00:00:02,000\nHello", "00:00:02,000 --> 00:00:04,000\nWorld"]);

describe("validateCues", () => {
  it("is unchecked (but not invalid) without a voiceover", () => {
    const v = validateCues(parseCaptions(good, "srt"), null);
    expect(v.status).toBe("unchecked");
    expect(v.valid).toBe(true);
  });
  it("is valid inside the voiceover", () => expect(validateCues(parseCaptions(good, "srt"), 10).status).toBe("valid"));
  it("is invalid when a cue runs past the voiceover", () => {
    const v = validateCues(parseCaptions(good, "srt"), 3);
    expect(v.status).toBe("invalid");
    expect(v.errors[0]).toMatch(/after the voiceover/);
  });
  it("flags out-of-order and zero-length cues", () => {
    const bad = srt(["00:00:05,000 --> 00:00:06,000\nB", "00:00:01,000 --> 00:00:01,000\nA"]);
    const v = validateCues(parseCaptions(bad, "srt"), 60);
    expect(v.errors.some((e) => /chronological/.test(e))).toBe(true);
    expect(v.errors.some((e) => /end must be after start/.test(e))).toBe(true);
  });
  it("rejects an empty list", () => expect(validateCues([], 10).status).toBe("invalid"));
  it("only warns about three-line cues, never changes them", () => {
    const cues = parseCaptions(srt(["00:00:00,000 --> 00:00:03,000\none\ntwo\nthree"]), "srt");
    const v = validateCues(cues, 10);
    expect(v.status).toBe("valid");
    expect(v.warnings[0]).toMatch(/3 lines/);
    expect(cues[0]!.text).toBe("one\ntwo\nthree");
  });
  it("warns about overlapping cues", () => {
    const v = validateCues(parseCaptions(srt(["00:00:00,000 --> 00:00:03,000\nA", "00:00:02,000 --> 00:00:04,000\nB"]), "srt"), 10);
    expect(v.warnings.some((w) => /overlaps/.test(w))).toBe(true);
  });
});

describe("parsing keeps text verbatim", () => {
  it("keeps Urdu text and tags exactly", () => {
    const text = "<i>یہ ایک جملہ ہے</i>";
    expect(parseCaptions(srt([`00:00:00,000 --> 00:00:02,000\n${text}`]), "srt")[0]!.text).toBe(text);
  });
  it("handles a BOM and CRLF line endings", () => {
    expect(parseCaptions("\uFEFF" + good.replace(/\n/g, "\r\n"), "srt")).toHaveLength(2);
  });
  it("parses VTT with header, ids and cue settings", () => {
    const vtt = "WEBVTT\nLanguage: ur\n\nintro\n00:01.000 --> 00:02.500 align:center\nسلام\n";
    const cues = parseCaptions(vtt, "vtt");
    expect(cues).toEqual([{ startMs: 1000, endMs: 2500, text: "سلام" }]);
    expect(declaredLanguage(vtt, "vtt")).toBe("ur");
  });
  it("throws on an unreadable SRT block", () => expect(() => parseCaptions("1\nnot a timestamp\ntext", "srt")).toThrow());
});

describe("detectScript", () => {
  it("detects Arabic script (Urdu, Arabic, Persian)", () => expect(detectScript([{ startMs: 0, endMs: 1, text: "یہ ایک جملہ ہے" }])).toBe("Arabic"));
  it("detects Latin script", () => expect(detectScript([{ startMs: 0, endMs: 1, text: "Hello there" }])).toBe("Latin"));
  it("returns null when there are no letters", () => expect(detectScript([{ startMs: 0, endMs: 1, text: "123 ..." }])).toBeNull());
});

describe("caption presets", () => {
  it("every preset satisfies the caption style schema with max two lines", () => {
    for (const p of CAPTION_PRESETS) {
      const s = captionStyleForPreset(p);
      expect(captionStyleSchema.safeParse(s).success, p).toBe(true);
      expect(s.maxLines).toBe(2);
    }
  });
  it("keeps contrast: a box or an outline behind every preset", () => {
    for (const p of CAPTION_PRESETS) {
      const s = captionStyleForPreset(p);
      expect(s.backgroundColor !== null || s.outlineColor !== null, p).toBe(true);
    }
  });
  it("carries the enabled flag", () => expect(captionStyleForPreset("boxed", false).enabled).toBe(false));
});
