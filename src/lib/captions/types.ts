import type { CaptionCue, CaptionValidation } from "./parse";
import type { CaptionPreset } from "./presets";

/** Client-safe view of a project's caption file. `cues` are the original Lafzaly cues, untouched. */
export type CaptionView = {
  fileName: string;
  format: "srt" | "vtt";
  cueCount: number;
  script: string | null;
  declaredLanguage: string | null;
  coverageSeconds: number;
  validation: Pick<CaptionValidation, "status" | "errors" | "warnings">;
  preset: CaptionPreset;
  enabled: boolean;
  uploadedAt: string;
  url: string;
  cues: CaptionCue[];
};
