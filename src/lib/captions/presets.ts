import type { VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";

export const CAPTION_PRESETS = ["minimal", "bold", "lower-third", "boxed", "outline"] as const;
export type CaptionPreset = (typeof CAPTION_PRESETS)[number];

export const PRESET_LABELS: Record<CaptionPreset, string> = {
  minimal: "Minimal", bold: "Bold", "lower-third": "Lower third", boxed: "Boxed", outline: "Outline",
};

/** Every preset keeps high contrast: either a dark box or a dark outline behind light text. */
export function captionStyleForPreset(preset: CaptionPreset, enabled = true): VidscriptPlan["captionStyle"] {
  const base = { enabled, maxLines: 2 as const };
  switch (preset) {
    case "minimal": return { ...base, position: "bottom", fontSize: 44, textColor: "#FFFFFF", backgroundColor: null, outlineColor: "#000000" };
    case "bold": return { ...base, position: "bottom", fontSize: 66, textColor: "#FFD84D", backgroundColor: null, outlineColor: "#000000" };
    case "lower-third": return { ...base, position: "center-bottom", fontSize: 52, textColor: "#FFFFFF", backgroundColor: "rgba(4,30,66,0.88)", outlineColor: null };
    case "boxed": return { ...base, position: "bottom", fontSize: 52, textColor: "#FFFFFF", backgroundColor: "rgba(0,0,0,0.65)", outlineColor: null };
    case "outline": return { ...base, position: "bottom", fontSize: 56, textColor: "#FFFFFF", backgroundColor: null, outlineColor: "#000000" };
  }
}
