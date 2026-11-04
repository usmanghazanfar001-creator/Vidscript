/** Client-safe helpers for voiceover files. */
export const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac"] as const;
export const MAX_VOICEOVER_BYTES = 300 * 1024 * 1024;
export const MIN_VOICEOVER_SECONDS = 1;
export const DURATION_TOLERANCE_SECONDS = 3;

export function audioExtension(fileName: string): (typeof ALLOWED_AUDIO_EXTENSIONS)[number] | null {
  const i = fileName.lastIndexOf(".");
  const ext = i >= 0 ? fileName.slice(i).toLowerCase() : "";
  return (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext) ? (ext as (typeof ALLOWED_AUDIO_EXTENSIONS)[number]) : null;
}

/** Display-only name: no path parts or control characters. */
export function safeDisplayName(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f]/g, "").slice(0, 200) || "voiceover";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export type DurationComparison = { deltaSeconds: number; percent: number; withinTolerance: boolean; direction: "longer" | "shorter" | "same" };

/** How the real voiceover compares with the storyboard timeline (the voiceover is the source of truth). */
export function compareDurations(storyboardSeconds: number, voiceoverSeconds: number): DurationComparison {
  const deltaSeconds = voiceoverSeconds - storyboardSeconds;
  return {
    deltaSeconds,
    percent: storyboardSeconds > 0 ? (deltaSeconds / storyboardSeconds) * 100 : 0,
    withinTolerance: Math.abs(deltaSeconds) <= DURATION_TOLERANCE_SECONDS,
    direction: Math.abs(deltaSeconds) < 0.05 ? "same" : deltaSeconds > 0 ? "longer" : "shorter",
  };
}
