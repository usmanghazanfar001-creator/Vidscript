import { getAudioDurationInSeconds } from "@remotion/media-utils";

/** Browser-side duration (Remotion media-utils). Only a fallback hint: the server's reading wins. */
export async function measureInBrowser(file: File): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const d = await getAudioDurationInSeconds(url);
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
