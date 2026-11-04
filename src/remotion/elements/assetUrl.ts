import type { Scene } from "../schemas/vidscriptSchema";

/** Where a stored asset is served from. In the browser preview the base is "" (same site); the renderer passes the app's address. */
export const assetSrc = (baseUrl: string, assetId: string) => `${baseUrl}/api/assets/${assetId}/file`;

/**
 * Scene types that read well over a photo or clip. Charts, maps, process diagrams and comparisons keep a plain
 * background so their detail stays crisp.
 */
const BACKDROP_TYPES: ReadonlyArray<Scene["type"]> = ["title", "hook", "bullets", "stat", "quote", "summary", "cta", "image", "timeline"];

export const hasBackdrop = (scene: Pick<Scene, "type" | "assetId" | "assetType">): boolean =>
  Boolean(scene.assetId && scene.assetType) && BACKDROP_TYPES.includes(scene.type);
