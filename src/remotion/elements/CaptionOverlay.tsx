import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionCue } from "@/lib/captions/parse";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

/** Renders Lafzaly cues verbatim at their original timing. Never edits text or timing. */
export const CaptionOverlay: React.FC<{ cues: CaptionCue[]; style: VidscriptPlan["captionStyle"] }> = ({ cues, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const cue = cues.find((c) => ms >= c.startMs && ms < c.endMs);
  if (!cue || !style.enabled) return null;

  const justify = style.position === "top" ? "flex-start" : style.position === "center-bottom" ? "flex-end" : "flex-end";
  const padBottom = style.position === "center-bottom" ? 220 : 72;
  return (
    <AbsoluteFill style={{ justifyContent: justify, alignItems: "center", paddingBottom: style.position === "top" ? 0 : padBottom, paddingTop: style.position === "top" ? 72 : 0 }}>
      <div
        dir="auto"
        style={{
          maxWidth: "80%",
          textAlign: "center",
          whiteSpace: "pre-line",
          fontSize: style.fontSize,
          fontWeight: 700,
          color: style.textColor,
          background: style.backgroundColor ?? "transparent",
          padding: style.backgroundColor ? "12px 28px" : 0,
          borderRadius: 12,
          WebkitTextStroke: style.outlineColor ? `3px ${style.outlineColor}` : undefined,
          paintOrder: "stroke fill",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
