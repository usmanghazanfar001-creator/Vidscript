import { AbsoluteFill, Img, Loop, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Scene } from "../schemas/vidscriptSchema";
import { assetSrc } from "./assetUrl";

/** A real photo (slow push-in) or clip (looped, muted) behind the scene, darkened so the text stays readable. */
export const SceneBackdrop: React.FC<{ scene: Scene; baseUrl: string }> = ({ scene, baseUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  if (!scene.assetId || !scene.assetType) return null;

  const src = assetSrc(baseUrl, scene.assetId);
  const fill = { width: "100%", height: "100%", objectFit: "cover" } as const;
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: "clamp" });
  // A clip shorter than the scene plays again from the start instead of freezing on its last frame.
  const clipFrames = scene.assetDurationSeconds ? Math.max(1, Math.floor(scene.assetDurationSeconds * fps)) : durationInFrames;

  return (
    <AbsoluteFill>
      {scene.assetType === "image" ? (
        <Img src={src} style={{ ...fill, transform: `scale(${zoom})` }} />
      ) : (
        <Loop durationInFrames={clipFrames}>
          <OffthreadVideo src={src} muted style={fill} />
        </Loop>
      )}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.72))" }} />
    </AbsoluteFill>
  );
};
