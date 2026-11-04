/**
 * Downloads are only ever made from the stock providers' own CDNs. This stops a tampered request from making
 * the server fetch an arbitrary URL (an internal address, for example).
 */
const ALLOWED_DOMAINS = ["pexels.com", "pixabay.com", "wikimedia.org"];

export function isAllowedAssetUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) return false;
  const host = u.hostname.toLowerCase();
  return ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}
