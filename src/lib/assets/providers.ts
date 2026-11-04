import type { Candidate, Orientation } from "./types";

/* ---------- parsing: pure functions over the providers' documented JSON ---------- */

type Json = Record<string, any>;
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
/** Commons returns author names as HTML ("<a href=...>Name</a>"). Credits are stored as plain text. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&(amp|lt|gt|quot|nbsp|#39);/g, (m) => ENTITIES[m] ?? m).replace(/\s+/g, " ").trim();
}

export function parsePexelsPhotos(json: Json): Candidate[] {
  return ((json.photos as Json[] | undefined) ?? []).flatMap((p) => {
    const src = (p.src ?? {}) as Json;
    const download = str(src.large2x) || str(src.large) || str(src.original);
    if (!p.id || !download || !str(src.medium) || !p.url) return [];
    return [{
      provider: "pexels", providerId: String(p.id), kind: "image", previewUrl: str(src.medium), previewType: "image", downloadUrl: download,
      width: num(p.width), height: num(p.height), durationSeconds: null,
      credit: `Photo by ${str(p.photographer, "unknown")} on Pexels`, creditUrl: str(p.photographer_url) || null, license: "Pexels License", pageUrl: str(p.url),
    } satisfies Candidate];
  });
}

/** Picks the MP4 closest to (but not above) full HD in the long direction: big enough to look sharp, small enough to download quickly. */
export function pickPexelsFile(files: Json[], orientation: Orientation): Json | null {
  const dim = (f: Json) => (orientation === "portrait" ? num(f.height) : num(f.width));
  const mp4 = files.filter((f) => str(f.file_type) === "video/mp4" && str(f.link) && dim(f) > 0);
  const fit = mp4.filter((f) => dim(f) <= 1920).sort((a, b) => dim(b) - dim(a));
  return fit[0] ?? mp4.sort((a, b) => dim(a) - dim(b))[0] ?? null;
}

export function parsePexelsVideos(json: Json, orientation: Orientation): Candidate[] {
  return ((json.videos as Json[] | undefined) ?? []).flatMap((v) => {
    const file = pickPexelsFile((v.video_files as Json[] | undefined) ?? [], orientation);
    if (!v.id || !file || !str(v.image) || !v.url) return [];
    const user = (v.user ?? {}) as Json;
    return [{
      provider: "pexels", providerId: String(v.id), kind: "video", previewUrl: str(v.image), previewType: "image", downloadUrl: str(file.link),
      width: num(file.width), height: num(file.height), durationSeconds: num(v.duration) || null,
      credit: `Video by ${str(user.name, "unknown")} on Pexels`, creditUrl: str(user.url) || null, license: "Pexels License", pageUrl: str(v.url),
    } satisfies Candidate];
  });
}

export function parsePixabayPhotos(json: Json): Candidate[] {
  return ((json.hits as Json[] | undefined) ?? []).flatMap((h) => {
    const download = str(h.largeImageURL) || str(h.webformatURL);
    if (!h.id || !download || !str(h.webformatURL) || !h.pageURL) return [];
    const user = str(h.user, "unknown");
    return [{
      provider: "pixabay", providerId: String(h.id), kind: "image", previewUrl: str(h.webformatURL), previewType: "image", downloadUrl: download,
      width: num(h.imageWidth), height: num(h.imageHeight), durationSeconds: null,
      credit: `Image by ${user} on Pixabay`, creditUrl: h.user_id ? `https://pixabay.com/users/${encodeURIComponent(user)}-${h.user_id}/` : null,
      license: "Pixabay Content License", pageUrl: str(h.pageURL),
    } satisfies Candidate];
  });
}

export function parsePixabayVideos(json: Json): Candidate[] {
  return ((json.hits as Json[] | undefined) ?? []).flatMap((h) => {
    const sizes = (h.videos ?? {}) as Json;
    const pick = [sizes.large, sizes.medium, sizes.small].find((s) => s && str(s.url) && num(s.width) > 0) as Json | undefined;
    const tiny = sizes.tiny as Json | undefined;
    if (!h.id || !pick || !h.pageURL) return [];
    const user = str(h.user, "unknown");
    return [{
      provider: "pixabay", providerId: String(h.id), kind: "video", previewUrl: str(tiny?.url) || str(pick.url), previewType: "video", downloadUrl: str(pick.url),
      width: num(pick.width), height: num(pick.height), durationSeconds: num(h.duration) || null,
      credit: `Video by ${user} on Pixabay`, creditUrl: h.user_id ? `https://pixabay.com/users/${encodeURIComponent(user)}-${h.user_id}/` : null,
      license: "Pixabay Content License", pageUrl: str(h.pageURL),
    } satisfies Candidate];
  });
}

/** Commons files carry many different licences. Only reusable ones are offered: public domain, CC0, CC BY and CC BY-SA (never NC or ND). */
export function isReusableCommonsLicense(name: string): boolean {
  if (!name) return false;
  if (/(^|[-\s])(nc|nd)([-\s]|$)/i.test(name)) return false;
  return /(public domain|^pd\b|cc0|^cc[- ]by)/i.test(name);
}

export function parseCommons(json: Json): Candidate[] {
  const pages = ((json.query?.pages as Json[] | undefined) ?? []).slice().sort((a, b) => num(a.index) - num(b.index));
  return pages.flatMap((p) => {
    const info = (p.imageinfo as Json[] | undefined)?.[0];
    if (!info) return [];
    const mime = str(info.mime);
    const license = stripHtml(str(info.extmetadata?.LicenseShortName?.value));
    const download = str(info.thumburl) || str(info.url);
    const width = num(info.thumbwidth) || num(info.width);
    const height = num(info.thumbheight) || num(info.height);
    if (!/^image\/(jpeg|png|webp)$/.test(mime) || !isReusableCommonsLicense(license) || !download || !width || !height || !str(info.descriptionurl)) return [];
    const artist = stripHtml(str(info.extmetadata?.Artist?.value)) || "Unknown author";
    return [{
      provider: "commons", providerId: String(p.pageid), kind: "image", previewUrl: download, previewType: "image", downloadUrl: download, width, height, durationSeconds: null,
      credit: `${artist} / Wikimedia Commons / ${license}`, creditUrl: str(info.descriptionurl), license, pageUrl: str(info.descriptionurl),
    } satisfies Candidate];
  });
}

/* ---------- network: thin wrappers that call the documented endpoints ---------- */

export class ProviderError extends Error {
  constructor(message: string, public status?: number) { super(message); }
}

const userAgent = () => process.env.ASSET_USER_AGENT ?? "Vidscript/0.1 (personal project; local use)";

async function getJson(url: string, headers: Record<string, string> = {}): Promise<Json> {
  const res = await fetch(url, { headers: { "User-Agent": userAgent(), ...headers }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (res.status === 429) throw new ProviderError("rate limit reached", 429);
  if (res.status === 401 || res.status === 403) throw new ProviderError("the API key was rejected", res.status);
  if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as Json;
}

export async function searchPexels(query: string, kind: "photo" | "video", orientation: Orientation, key: string): Promise<Candidate[]> {
  const q = encodeURIComponent(query);
  if (kind === "photo") return parsePexelsPhotos(await getJson(`https://api.pexels.com/v1/search?query=${q}&per_page=8&orientation=${orientation}`, { Authorization: key }));
  return parsePexelsVideos(await getJson(`https://api.pexels.com/v1/videos/search?query=${q}&per_page=8&orientation=${orientation}`, { Authorization: key }), orientation);
}

export async function searchPixabay(query: string, kind: "photo" | "video", orientation: Orientation, key: string): Promise<Candidate[]> {
  const q = encodeURIComponent(query);
  if (kind === "photo") {
    const o = orientation === "portrait" ? "vertical" : "horizontal";
    const min = orientation === "portrait" ? "min_width=720&min_height=1280" : "min_width=1280&min_height=720";
    return parsePixabayPhotos(await getJson(`https://pixabay.com/api/?key=${key}&q=${q}&image_type=photo&orientation=${o}&${min}&per_page=10&safesearch=true`));
  }
  return parsePixabayVideos(await getJson(`https://pixabay.com/api/videos/?key=${key}&q=${q}&per_page=10&safesearch=true`));
}

export async function searchCommons(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "12",
    prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "1600", format: "json", formatversion: "2",
  });
  return parseCommons(await getJson(`https://commons.wikimedia.org/w/api.php?${params}`));
}
