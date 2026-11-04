/**
 * Read-only parsing of Lafzaly SRT/VTT files for validation and preview.
 * Vidscript never rewrites caption text or timing: cue text is returned verbatim.
 * (The Remotion render path uses @remotion/captions parseSrt() for .srt files.)
 */
export type CaptionCue = { startMs: number; endMs: number; text: string };

const TS = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/;

function toMs(ts: string): number | null {
  const m = TS.exec(ts.trim());
  if (!m) return null;
  const [, h, mi, s, ms] = m;
  return (Number(h ?? 0) * 3600 + Number(mi) * 60 + Number(s)) * 1000 + Number((ms ?? "0").padEnd(3, "0"));
}

export function parseCaptions(input: string, format: "srt" | "vtt"): CaptionCue[] {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const cues: CaptionCue[] = [];
  // Blocks are separated by blank lines (which may contain stray spaces). Trimming first means a file's trailing
  // newline never leaks into the last cue's text.
  for (const block of text.trim().split(/\n[ \t]*\n\s*/)) {
    const lines = block.split("\n").filter((l, i, arr) => !(i === 0 && arr.length > 1 && /^\d+$/.test(l.trim())));
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) {
      if (format === "srt" && block.trim()) throw new Error(`Invalid SRT block: "${block.slice(0, 40)}"`);
      continue; // VTT header / NOTE blocks
    }
    const [a, b] = lines[timeIdx]!.split("-->");
    const startMs = toMs(a ?? "");
    const endMs = toMs((b ?? "").trim().split(/\s+/)[0] ?? "");
    if (startMs == null || endMs == null) throw new Error(`Invalid timestamp: "${lines[timeIdx]}"`);
    cues.push({ startMs, endMs, text: lines.slice(timeIdx + 1).join("\n") });
  }
  return cues;
}

export type CaptionValidation = {
  valid: boolean;
  /** "unchecked" = structurally fine, but there is no voiceover yet to check the timing against. */
  status: "valid" | "invalid" | "unchecked";
  errors: string[];
  warnings: string[];
  cueCount: number;
  coverageSeconds: number;
};

const OVERRUN_TOLERANCE_MS = 500;
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, "0")}`;

export function validateCues(cues: CaptionCue[], voiceoverSeconds: number | null = null): CaptionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (cues.length === 0) errors.push("The file contains no captions");
  const limitMs = voiceoverSeconds == null ? null : voiceoverSeconds * 1000;
  cues.forEach((c, i) => {
    const n = i + 1, prev = cues[i - 1];
    if (c.startMs < 0) errors.push(`Cue ${n}: starts before 0:00`);
    if (c.endMs <= c.startMs) errors.push(`Cue ${n} (${mmss(c.startMs)}): end must be after start`);
    if (prev && c.startMs < prev.startMs) errors.push(`Cue ${n} (${mmss(c.startMs)}): not in chronological order`);
    if (limitMs != null && c.endMs > limitMs + OVERRUN_TOLERANCE_MS) errors.push(`Cue ${n}: ends at ${mmss(c.endMs)}, after the voiceover (${mmss(limitMs)})`);
    // Warnings never block a render; captions are shown exactly as Lafzaly exported them.
    const lines = c.text.split("\n").length;
    if (lines > 2) warnings.push(`Cue ${n} has ${lines} lines; captions are designed for two. It will be shown unchanged.`);
    if (c.endMs > c.startMs && c.endMs - c.startMs < 300) warnings.push(`Cue ${n} is shorter than 0.3s and may flash by.`);
    if (prev && c.startMs < prev.endMs && c.startMs >= prev.startMs) warnings.push(`Cue ${n} overlaps the previous cue; only one cue is shown at a time.`);
  });
  const last = cues[cues.length - 1];
  const status = errors.length > 0 ? "invalid" : voiceoverSeconds == null ? "unchecked" : "valid";
  return { valid: status !== "invalid", status, errors, warnings, cueCount: cues.length, coverageSeconds: last ? last.endMs / 1000 : 0 };
}

/** Language declared in a WebVTT header ("Language: ur"); SRT has no such field. */
export function declaredLanguage(text: string, format: "srt" | "vtt"): string | null {
  if (format !== "vtt") return null;
  const header = text.replace(/^\uFEFF/, "").split(/\r?\n\r?\n/)[0] ?? "";
  return /^\s*Language:\s*(\S+)/im.exec(header)?.[1] ?? null;
}

const SCRIPTS: Array<[string, RegExp]> = [
  ["Arabic", /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g],
  ["Latin", /[A-Za-z\u00C0-\u024F]/g],
  ["Devanagari", /[\u0900-\u097F]/g],
  ["Cyrillic", /[\u0400-\u04FF]/g],
  ["Hebrew", /[\u0590-\u05FF]/g],
  ["CJK", /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g],
];

/** Dominant writing system in the cue text (a script, not a language: Arabic script covers Urdu, Arabic, Persian). */
export function detectScript(cues: CaptionCue[]): string | null {
  const sample = cues.slice(0, 200).map((c) => c.text).join(" ");
  let best: string | null = null, max = 0;
  for (const [name, re] of SCRIPTS) {
    const n = sample.match(re)?.length ?? 0;
    if (n > max) { max = n; best = name; }
  }
  return best;
}
