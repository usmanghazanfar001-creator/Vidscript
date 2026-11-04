import { ProviderError, searchCommons, searchPexels, searchPixabay } from "./providers";
import { PROVIDER_LABELS, type AssetProvider, type Candidate, type Orientation, type WantedKind } from "./types";

export type ProviderReport = { provider: AssetProvider; ok: boolean; count: number; error?: string };
export type SearchResult = { candidates: Candidate[]; providers: ProviderReport[]; configured: AssetProvider[] };

/** Providers that can serve this kind, in order of preference, limited to those with a key (Commons needs none). */
export function configuredProviders(kind: WantedKind, env: Record<string, string | undefined> = process.env): AssetProvider[] {
  const out: AssetProvider[] = [];
  if (env.PEXELS_API_KEY) out.push("pexels");
  if (env.PIXABAY_API_KEY) out.push("pixabay");
  if (kind === "photo") out.push("commons"); // Commons only has still images
  return out;
}

// Pixabay requires search results to be cached for 24 hours; the same cache also protects the free-tier rate limits.
const TTL_MS = 24 * 60 * 60 * 1000;
type Cached = { at: number; value: SearchResult };
const cache = ((globalThis as unknown as { __vsSearchCache?: Map<string, Cached> }).__vsSearchCache ??= new Map());

const describe = (e: unknown) =>
  e instanceof ProviderError ? (e.status === 429 ? "rate limit reached, try again later" : e.message) : e instanceof Error && e.name === "TimeoutError" ? "timed out" : "request failed";

export async function searchAssets(opts: { query: string; kind: WantedKind; orientation: Orientation }, env: Record<string, string | undefined> = process.env): Promise<SearchResult> {
  const query = opts.query.replace(/\s+/g, " ").trim().slice(0, 100);
  const configured = configuredProviders(opts.kind, env);
  const cacheKey = JSON.stringify([query.toLowerCase(), opts.kind, opts.orientation, configured]);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const calls = configured.map(async (provider): Promise<Candidate[]> => {
    if (provider === "pexels") return searchPexels(query, opts.kind, opts.orientation, env.PEXELS_API_KEY!);
    if (provider === "pixabay") return searchPixabay(query, opts.kind, opts.orientation, env.PIXABAY_API_KEY!);
    return searchCommons(query);
  });
  const settled = await Promise.allSettled(calls);
  const providers: ProviderReport[] = settled.map((r, i) =>
    r.status === "fulfilled" ? { provider: configured[i]!, ok: true, count: r.value.length } : { provider: configured[i]!, ok: false, count: 0, error: `${PROVIDER_LABELS[configured[i]!]}: ${describe(r.reason)}` },
  );
  const candidates = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const value = { candidates, providers, configured };

  // Cache only complete answers, so a temporary provider failure is not remembered for a day.
  if (providers.every((p) => p.ok)) {
    if (cache.size > 200) cache.delete(cache.keys().next().value as string);
    cache.set(cacheKey, { at: Date.now(), value });
  }
  return value;
}

/** First candidate that is big enough and the right shape for the video; falls back to a smaller one rather than nothing. */
export function pickBest(candidates: Candidate[], orientation: Orientation): Candidate[] {
  const shapeOk = (c: Candidate) => (orientation === "portrait" ? c.height >= c.width : c.width >= c.height);
  const long = (c: Candidate) => (orientation === "portrait" ? c.height : c.width);
  const good = candidates.filter((c) => shapeOk(c) && long(c) >= 1280);
  const ok = candidates.filter((c) => shapeOk(c) && long(c) >= 960 && !good.includes(c));
  return [...good, ...ok];
}
