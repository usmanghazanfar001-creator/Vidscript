import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { vidscriptPlanSchema, type Scene } from "../schemas/vidscriptSchema";
import { BackgroundMotion } from "../elements/BackgroundMotion";
import { SceneBackdrop } from "../elements/SceneBackdrop";
import { hasBackdrop } from "../elements/assetUrl";
import { BrandFrame } from "../elements/BrandFrame";
import { CaptionOverlay } from "../elements/CaptionOverlay";
import { TitleScene } from "../scenes/TitleScene";
import { BulletScene } from "../scenes/BulletScene";
import { StatScene } from "../scenes/StatScene";
import { FallbackScene } from "../scenes/FallbackScene";
import { HookScene } from "../scenes/HookScene";
import { MapScene } from "../scenes/MapScene";
import { TerrainMapScene } from "../scenes/TerrainMapScene";
import { TradeRouteScene } from "../scenes/TradeRouteScene";
import { AnimatedBordersScene } from "../scenes/AnimatedBordersScene";
import { BeforeAfterMapScene } from "../scenes/BeforeAfterMapScene";
import { TimelineScene } from "../scenes/TimelineScene";
import { ProcessScene } from "../scenes/ProcessScene";
import { ComparisonScene } from "../scenes/ComparisonScene";
import { ChartScene } from "../scenes/ChartScene";
import { QuoteScene } from "../scenes/QuoteScene";
import { ImageScene } from "../scenes/ImageScene";
import { SummaryScene } from "../scenes/SummaryScene";
import { CtaScene } from "../scenes/CtaScene";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

export const captionCueSchema = z.object({ startMs: z.number(), endMs: z.number(), text: z.string() });
export const vidscriptPropsSchema = z.object({
  plan: vidscriptPlanSchema,
  captions: z.array(captionCueSchema).nullable(),
  /** Address that stored assets are served from. "" in the browser preview; the app's URL when rendering. */
  assetBaseUrl: z.string().default(""),
});
export type VidscriptProps = z.infer<typeof vidscriptPropsSchema>;

const FADE_FRAMES = 12;

const SceneBody: React.FC<{ scene: Scene; brand: VidscriptPlan["brand"] }> = ({ scene, brand }) => {
  const v = scene.visual;
  switch (scene.type) {
    case "title": return <TitleScene scene={scene} brand={brand} />;
    case "hook": return <HookScene scene={scene} brand={brand} />;
    case "map":
      if ("regions" in v) {
        switch (v.kind) {
          case "terrainMap": return <TerrainMapScene scene={scene} visual={v} brand={brand} />;
          case "tradeRoutes": return <TradeRouteScene scene={scene} visual={v} brand={brand} />;
          case "animatedBorders": return <AnimatedBordersScene scene={scene} visual={v} brand={brand} />;
          case "beforeAfterMap": return <BeforeAfterMapScene scene={scene} visual={v} brand={brand} />;
          default: return <MapScene scene={scene} visual={v} brand={brand} />;
        }
      }
      break;
    case "timeline": if (v.kind === "timeline") return <TimelineScene scene={scene} visual={v} brand={brand} />; break;
    case "bullets": return <BulletScene scene={scene} brand={brand} />;
    case "process": if (v.kind === "stepDiagram") return <ProcessScene scene={scene} visual={v} brand={brand} />; break;
    case "comparison": if (v.kind === "twoColumnComparison") return <ComparisonScene scene={scene} visual={v} brand={brand} />; break;
    case "chart": if (v.kind === "lineChart" || v.kind === "barChart" || v.kind === "donutChart") return <ChartScene scene={scene} visual={v} brand={brand} />; break;
    case "quote": if (v.kind === "quoteCard") return <QuoteScene scene={scene} visual={v} brand={brand} />; break;
    case "image": if (v.kind === "imageWithCaption") return <ImageScene scene={scene} visual={v} brand={brand} />; break;
    case "stat": if (v.kind === "statCallout") return <StatScene scene={scene} brand={brand} />; break;
    case "summary": if (v.kind === "bulletList" || v.kind === "checklist") return <SummaryScene scene={scene} visual={v} brand={brand} />; break;
    case "cta": if (v.kind === "callToAction") return <CtaScene scene={scene} visual={v} brand={brand} />; break;
  }
  return <FallbackScene scene={scene} brand={brand} />;
};

const FadeWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(frame, [0, FADE_FRAMES, durationInFrames - FADE_FRAMES, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const VidscriptVideo: React.FC<VidscriptProps> = ({ plan, captions, assetBaseUrl }) => {
  const { fps } = useVideoConfig();
  const isFinal = plan.mode === "final-render";
  return (
    <BrandFrame brand={plan.brand}>
      <BackgroundMotion from={plan.brand.backgroundColor} accent={plan.brand.accentColor} />
      {isFinal && plan.voiceoverUrl ? <Audio src={plan.voiceoverUrl} /> : null}
      {plan.scenes.map((scene) => (
        <Sequence key={scene.id} from={Math.round(scene.startSeconds * fps)} durationInFrames={Math.max(1, Math.round((scene.endSeconds - scene.startSeconds) * fps))} name={scene.title}>
          <FadeWrap>
            {hasBackdrop(scene) ? <SceneBackdrop scene={scene} baseUrl={assetBaseUrl} /> : null}
            <SceneBody scene={scene} brand={plan.brand} />
          </FadeWrap>
        </Sequence>
      ))}
      {isFinal && captions && captions.length > 0 ? <CaptionOverlay cues={captions} style={plan.captionStyle} /> : null}
      {!isFinal ? <div style={{ position: "absolute", left: 40, bottom: 28, fontSize: 24, opacity: 0.55 }}>SILENT DRAFT</div> : null}
    </BrandFrame>
  );
};
