/** Reduces decoded audio to `buckets` normalized (0..1) peak values for drawing a waveform. */
export function computePeaks(channels: Float32Array[], buckets: number): number[] {
  const length = channels[0]?.length ?? 0;
  if (length === 0 || buckets <= 0) return [];
  const peaks = new Array<number>(buckets).fill(0);
  const per = length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * per), to = Math.min(length, Math.floor((b + 1) * per));
    let max = 0;
    for (const ch of channels) for (let i = from; i < to; i++) { const v = Math.abs(ch[i]!); if (v > max) max = v; }
    peaks[b] = max;
  }
  const top = Math.max(...peaks) || 1;
  return peaks.map((p) => p / top);
}

const MAX_WAVEFORM_BYTES = 80 * 1024 * 1024;

/** Browser only. Very large files are skipped because decoding needs far more memory than the file size. */
export async function loadPeaks(url: string, buckets = 1200): Promise<number[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load the voiceover for the waveform");
  if (Number(res.headers.get("content-length")) > MAX_WAVEFORM_BYTES) throw new Error("Waveform skipped: the voiceover file is too large to draw in the browser");
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await res.arrayBuffer());
    return computePeaks(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)), buckets);
  } catch {
    throw new Error("Waveform unavailable: this browser could not decode the audio");
  } finally {
    void ctx.close();
  }
}
