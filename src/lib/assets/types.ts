import { z } from "zod";

export const ASSET_PROVIDERS = ["pexels", "pixabay", "commons"] as const;
export type AssetProvider = (typeof ASSET_PROVIDERS)[number];
export type WantedKind = "photo" | "video";
export type Orientation = "landscape" | "portrait";

export const PROVIDER_LABELS: Record<AssetProvider, string> = { pexels: "Pexels", pixabay: "Pixabay", commons: "Wikimedia Commons" };

/** One search result. Everything about where it came from travels with it: source, creator, licence and page. */
export const candidateSchema = z.object({
  provider: z.enum(ASSET_PROVIDERS),
  providerId: z.string().min(1).max(200),
  kind: z.enum(["image", "video"]),
  previewUrl: z.string().url(),
  previewType: z.enum(["image", "video"]),
  downloadUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSeconds: z.number().nullable(),
  credit: z.string().max(500),
  creditUrl: z.string().url().nullable(),
  license: z.string().max(200),
  pageUrl: z.string().url(),
});
export type Candidate = z.infer<typeof candidateSchema>;

export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(100),
  kind: z.enum(["photo", "video"]),
  orientation: z.enum(["landscape", "portrait"]).default("landscape"),
});

/** The scene fields that describe a stored asset. */
export type SceneAssetFields = {
  assetId: string;
  assetType: "image" | "video";
  assetProvider: string;
  assetCredit: string;
  assetLicense: string;
  assetSourceUrl: string;
  assetDurationSeconds: number | null;
};

export type StoredAsset = {
  id: string; provider: AssetProvider; kind: "image" | "video"; credit: string; license: string; pageUrl: string;
  width: number; height: number; durationSeconds: number | null;
};

export function sceneFieldsFromAsset(a: StoredAsset): SceneAssetFields {
  return {
    assetId: a.id, assetType: a.kind, assetProvider: a.provider, assetCredit: a.credit,
    assetLicense: a.license, assetSourceUrl: a.pageUrl, assetDurationSeconds: a.durationSeconds,
  };
}

export const CLEARED_ASSET_FIELDS = {
  assetId: null, assetType: null, assetProvider: null, assetCredit: null, assetLicense: null, assetSourceUrl: null, assetDurationSeconds: null,
} as const;
