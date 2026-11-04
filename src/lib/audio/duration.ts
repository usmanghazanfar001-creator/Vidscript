import { parseMedia } from "@remotion/media-parser";
import { nodeReader } from "@remotion/media-parser/node";

/**
 * Reads the real duration of an audio file on the server using Remotion's media parser.
 * Returns null when the container has no duration (some raw .aac streams); throws if the file is not readable media.
 */
export async function readAudioDuration(filePath: string): Promise<number | null> {
  const result = await parseMedia({ src: filePath, reader: nodeReader, fields: { durationInSeconds: true } });
  const d = result.durationInSeconds;
  return typeof d === "number" && Number.isFinite(d) ? d : null;
}
