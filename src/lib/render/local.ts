import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { VidscriptPlan } from "@/remotion/schemas/vidscriptSchema";
import { getFreePort } from "./port";

let bundlePromise: Promise<string> | null = null;

/** Bundles the Remotion project once per process and reuses it for every render. */
function getServeUrl(): Promise<string> {
  bundlePromise ??= bundle({
    entryPoint: path.resolve(process.cwd(), "src/remotion/index.ts"),
    webpackOverride: (config) => ({
      ...config,
      resolve: { ...config.resolve, alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve(process.cwd(), "src") } },
    }),
  }).catch((e) => {
    bundlePromise = null; // allow a retry after a failed bundle
    throw e;
  });
  return bundlePromise;
}

export type CancelSignal = NonNullable<Parameters<typeof renderMedia>[0]["cancelSignal"]>;

/** Renders a silent draft: H.264, CRF 18, no audio track, no captions. */
export async function renderSilentDraft(
  plan: VidscriptPlan,
  outputLocation: string,
  opts: { onProgress?: (fraction: number) => void; cancelSignal?: CancelSignal } = {},
) {
  if (plan.mode !== "silent-draft") throw new Error("renderSilentDraft only renders silent drafts");
  const serveUrl = await getServeUrl();
  // Stored stock photos/clips are fetched from the app itself, so the renderer needs its address.
  const inputProps = { plan, captions: null, assetBaseUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "") };
  // Never let Remotion pick its own port: it starts near 3000 and can end up talking to the Next.js dev server instead.
  const port = await getFreePort();
  const composition = await selectComposition({ serveUrl, id: "VidscriptVideo", inputProps, port });
  await renderMedia({
    composition, serveUrl, inputProps, outputLocation, port,
    codec: "h264", crf: 18, muted: true,
    cancelSignal: opts.cancelSignal,
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  return { durationInFrames: composition.durationInFrames, fps: composition.fps };
}
