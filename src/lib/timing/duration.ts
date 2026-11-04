export const WPM_MIN = 120;
export const WPM_MAX = 190;
export const WPM_DEFAULT = 150;
export const FPS = 30;

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Counts words in plain text or Markdown (syntax characters are ignored). */
export function countWords(script: string): number {
  const cleaned = script.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`~[\]()!|-]+/g, " ");
  return cleaned.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function assertValidWpm(wpm: number): void {
  if (!Number.isFinite(wpm) || wpm < WPM_MIN || wpm > WPM_MAX) {
    throw new RangeError(`Narration pace must be between ${WPM_MIN} and ${WPM_MAX} WPM`);
  }
}

/** estimatedSeconds = (wordCount / wordsPerMinute) * 60 */
export function estimateSeconds(wordCount: number, wpm: number = WPM_DEFAULT): number {
  assertValidWpm(wpm);
  return (wordCount / wpm) * 60;
}

export const toFrames = (seconds: number, fps: number = FPS) => Math.ceil(seconds * fps);

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Splits [0, total] into contiguous boundaries proportional to the given weights. */
export function proportionalBoundaries(total: number, weights: number[]): Array<{ start: number; end: number }> {
  const sum = weights.reduce((a, b) => a + b, 0) || weights.length;
  let cursor = 0;
  return weights.map((w, i) => {
    const start = cursor;
    cursor = i === weights.length - 1 ? total : cursor + (total * (w || 1)) / sum;
    return { start: round3(start), end: round3(cursor) };
  });
}
