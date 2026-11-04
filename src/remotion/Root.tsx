import { NO_ASSET } from "./schemas/vidscriptSchema";
import { Composition } from "remotion";
import { parseSrt } from "@remotion/captions";
import { VidscriptVideo, vidscriptPropsSchema, type VidscriptProps } from "./compositions/VidscriptVideo";
import { computeDurationInFrames } from "@/lib/render/metadata";
import { parseCaptions, type CaptionCue } from "@/lib/captions/parse";
import { defaultBrand, defaultCaptionStyle } from "./themes/defaultTheme";

const demo: VidscriptProps = {
  captions: null,
  assetBaseUrl: "",
  plan: {
    version: "1.0", title: "Vidscript demo", mode: "silent-draft", sourceScript: "", voiceoverUrl: null, captionsUrl: null,
    estimatedDurationSeconds: 12, actualDurationSeconds: null, fps: 30, width: 1920, height: 1080, wordsPerMinute: 150,
    visualStyle: "educational slides", brand: { ...defaultBrand }, captionStyle: { ...defaultCaptionStyle },
    scenes: [
      { id: "s1", startSeconds: 0, endSeconds: 4, type: "title", title: "Turn your script into animated visuals", subtitle: "Vidscript", scriptExcerpt: null,
        visual: { kind: "callToAction", text: "Vidscript", url: null }, animation: "fade", transitionIn: "fade", transitionOut: "fade", imagePrompt: null, imageUrl: null, notes: null, ...NO_ASSET },
      { id: "s2", startSeconds: 4, endSeconds: 12, type: "bullets", title: "How it works", subtitle: null, scriptExcerpt: null,
        visual: { kind: "bulletList", items: ["Paste your script", "Review the storyboard", "Render a silent draft"] }, animation: "fade", transitionIn: "fade", transitionOut: "fade", imagePrompt: null, imageUrl: null, notes: null, ...NO_ASSET },
    ],
  },
};

async function loadCaptions(url: string): Promise<CaptionCue[]> {
  const text = await (await fetch(url)).text();
  if (url.toLowerCase().split("?")[0]!.endsWith(".srt")) {
    return parseSrt({ input: text }).captions.map((c) => ({ startMs: c.startMs, endMs: c.endMs, text: c.text }));
  }
  return parseCaptions(text, "vtt");
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="VidscriptVideo"
    component={VidscriptVideo}
    schema={vidscriptPropsSchema}
    defaultProps={demo}
    fps={30}
    width={1920}
    height={1080}
    durationInFrames={360}
    calculateMetadata={async ({ props }) => {
      const { plan } = props;
      const wantsCaptions = plan.mode === "final-render" && plan.captionStyle.enabled && plan.captionsUrl;
      const captions = wantsCaptions ? await loadCaptions(plan.captionsUrl!) : null;
      return {
        durationInFrames: computeDurationInFrames(plan, plan.fps),
        fps: plan.fps, width: plan.width, height: plan.height,
        props: { ...props, captions },
      };
    }}
  />
);
