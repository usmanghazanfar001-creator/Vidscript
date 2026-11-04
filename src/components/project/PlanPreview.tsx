"use client";
import { Player } from "@remotion/player";
import { VidscriptVideo } from "@/remotion/compositions/VidscriptVideo";
import type { VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";

export function PlanPreview({ plan }: { plan: VidscriptPlan }) {
  const last = plan.scenes[plan.scenes.length - 1]?.endSeconds ?? 1;
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <Player
        component={VidscriptVideo}
        inputProps={{ plan, captions: null, assetBaseUrl: "" }}
        durationInFrames={Math.max(1, Math.ceil(last * plan.fps))}
        compositionWidth={plan.width}
        compositionHeight={plan.height}
        fps={plan.fps}
        controls
        style={{ width: "100%" }}
      />
    </div>
  );
}
