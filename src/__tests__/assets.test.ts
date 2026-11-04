import { describe, expect, it } from "vitest";
import http from "node:http";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { isAllowedAssetUrl } from "@/lib/assets/hosts";
import { isReusableCommonsLicense, parseCommons, parsePexelsPhotos, parsePexelsVideos, parsePixabayPhotos, parsePixabayVideos, stripHtml } from "@/lib/assets/providers";
import { configuredProviders, pickBest, searchAssets } from "@/lib/assets/search";
import { DownloadError, downloadToFile, sniffType } from "@/lib/assets/download";
import { candidateSchema, sceneFieldsFromAsset, type Candidate } from "@/lib/assets/types";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2000, 1)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(2000, 2)]);

describe("isAllowedAssetUrl", () => {
  it("accepts the providers' own CDNs over https", () => {
    for (const u of ["https://images.pexels.com/a.jpg", "https://videos.pexels.com/v/a.mp4", "https://cdn.pixabay.com/v/a.mp4", "https://pixabay.com/get/a.jpg", "https://upload.wikimedia.org/a.jpg"]) expect(isAllowedAssetUrl(u), u).toBe(true);
  });
  it("rejects look-alikes, other hosts, plain http, odd ports and embedded credentials", () => {
    for (const u of ["http://images.pexels.com/a.jpg", "https://evilpexels.com/a", "https://pexels.com.evil.com/a", "https://localhost/a", "https://169.254.169.254/latest", "https://u:p@images.pexels.com/a", "https://images.pexels.com:8443/a", "not a url"]) expect(isAllowedAssetUrl(u), u).toBe(false);
  });
});

describe("provider parsing", () => {
  it("Pexels photos: credit, licence, large download", () => {
    const [c] = parsePexelsPhotos({ photos: [{ id: 2014422, width: 3024, height: 2016, url: "https://www.pexels.com/photo/x-2014422/", photographer: "Joey Farina", photographer_url: "https://www.pexels.com/@joey", src: { large2x: "https://images.pexels.com/photos/2014422/a.jpeg?dpr=2", medium: "https://images.pexels.com/photos/2014422/a.jpeg?h=350" } }] });
    expect(candidateSchema.safeParse(c).success).toBe(true);
    expect(c).toMatchObject({ provider: "pexels", providerId: "2014422", kind: "image", license: "Pexels License", credit: "Photo by Joey Farina on Pexels" });
    expect(c!.downloadUrl).toMatch(/dpr=2/);
  });
  it("Pexels videos: chooses the HD MP4, not 4K or SD", () => {
    const f = (id: number, w: number, h: number) => ({ id, file_type: "video/mp4", width: w, height: h, link: `https://videos.pexels.com/video-files/1/${w}.mp4` });
    const [c] = parsePexelsVideos({ videos: [{ id: 1, url: "https://www.pexels.com/video/1/", image: "https://images.pexels.com/videos/1/p.jpg", duration: 30, user: { name: "John Doe", url: "https://www.pexels.com/@jd" }, video_files: [f(1, 960, 540), f(2, 1920, 1080), f(3, 3840, 2160), { ...f(4, 1920, 1080), file_type: "video/webm" }] }] }, "landscape");
    expect(c).toMatchObject({ width: 1920, kind: "video", durationSeconds: 30, credit: "Video by John Doe on Pexels" });
    expect(c!.downloadUrl).toMatch(/1920\.mp4$/);
  });
  it("Pexels portrait videos are chosen by height", () => {
    const f = (w: number, h: number) => ({ file_type: "video/mp4", width: w, height: h, link: `https://videos.pexels.com/x/${h}.mp4` });
    const [c] = parsePexelsVideos({ videos: [{ id: 1, url: "https://www.pexels.com/video/1/", image: "https://images.pexels.com/p.jpg", duration: 5, user: { name: "A" }, video_files: [f(1080, 1920), f(2160, 3840), f(540, 960)] }] }, "portrait");
    expect(c!.height).toBe(1920);
  });
  it("Pixabay photos and videos", () => {
    const [p] = parsePixabayPhotos({ hits: [{ id: 195893, pageURL: "https://pixabay.com/photos/blossom-195893/", webformatURL: "https://pixabay.com/get/a_640.jpg", largeImageURL: "https://pixabay.com/get/a_1280.jpg", imageWidth: 4000, imageHeight: 3000, user: "Josch13", user_id: 1664300 }] });
    expect(p).toMatchObject({ provider: "pixabay", license: "Pixabay Content License", credit: "Image by Josch13 on Pixabay" });
    expect(p!.downloadUrl).toMatch(/1280/);
    const v = (large: string) => parsePixabayVideos({ hits: [{ id: 125, pageURL: "https://pixabay.com/videos/id-125/", duration: 12, user: "Coverr", user_id: 9, videos: { large: { url: large, width: large ? 1920 : 0, height: 1080 }, medium: { url: "https://cdn.pixabay.com/video/m.mp4", width: 1280, height: 720 }, tiny: { url: "https://cdn.pixabay.com/video/t.mp4", width: 640, height: 360 } } }] })[0]!;
    expect(v("https://cdn.pixabay.com/video/l.mp4").width).toBe(1920);
    expect(v("").width).toBe(1280); // large missing -> medium
    expect(v("").previewType).toBe("video");
  });
  it("drops provider rows that are missing what we need", () => {
    expect(parsePexelsPhotos({ photos: [{ id: 1 }] })).toEqual([]);
    expect(parsePixabayVideos({ hits: [{ id: 1, pageURL: "https://pixabay.com/x", videos: {} }] })).toEqual([]);
    expect(parseCommons({})).toEqual([]);
  });
  it("Commons: keeps reusable licences and real photos, orders by relevance, writes plain-text credit", () => {
    const page = (pageid: number, index: number, license: string, mime = "image/jpeg") => ({
      pageid, index, imageinfo: [{ thumburl: `https://upload.wikimedia.org/t${pageid}.jpg`, thumbwidth: 1600, thumbheight: 1000, mime, descriptionurl: `https://commons.wikimedia.org/wiki/File:${pageid}.jpg`,
        extmetadata: { LicenseShortName: { value: license }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; Co</a>' } } }],
    });
    const out = parseCommons({ query: { pages: [page(3, 3, "Public domain"), page(1, 1, "CC BY-NC 4.0"), page(2, 2, "CC BY-SA 4.0"), page(4, 4, "CC BY 2.0", "image/svg+xml")] } });
    expect(out.map((c) => c.providerId)).toEqual(["2", "3"]);
    expect(out[0]!.credit).toBe("Jane & Co / Wikimedia Commons / CC BY-SA 4.0");
  });
  it("licence filter", () => {
    for (const ok of ["CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain", "PD-old-70", "CC BY 4.0"]) expect(isReusableCommonsLicense(ok), ok).toBe(true);
    for (const no of ["CC BY-NC 4.0", "CC BY-ND 2.0", "CC BY-NC-SA 3.0", "GFDL", "Fair use", ""]) expect(isReusableCommonsLicense(no), no).toBe(false);
  });
  it("stripHtml", () => expect(stripHtml('<a href="x">A &amp; B</a>  <b>C</b>')).toBe("A & B C"));
});

describe("searching", () => {
  const cand = (over: Partial<Candidate>): Candidate => ({ provider: "pexels", providerId: "1", kind: "image", previewUrl: "https://images.pexels.com/p.jpg", previewType: "image", downloadUrl: "https://images.pexels.com/d.jpg", width: 1920, height: 1080, durationSeconds: null, credit: "c", creditUrl: null, license: "l", pageUrl: "https://www.pexels.com/x", ...over });
  it("only offers providers that are configured; Commons never serves video", () => {
    expect(configuredProviders("photo", {})).toEqual(["commons"]);
    expect(configuredProviders("video", {})).toEqual([]);
    expect(configuredProviders("video", { PEXELS_API_KEY: "k", PIXABAY_API_KEY: "k" })).toEqual(["pexels", "pixabay"]);
    expect(configuredProviders("photo", { PEXELS_API_KEY: "k" })).toEqual(["pexels", "commons"]);
  });
  it("pickBest prefers big, correctly shaped results and skips wrong orientation", () => {
    const small = cand({ providerId: "s", width: 1000, height: 700 });
    const big = cand({ providerId: "b" });
    const tall = cand({ providerId: "t", width: 1080, height: 1920 });
    const tiny = cand({ providerId: "x", width: 400, height: 300 });
    expect(pickBest([small, tall, tiny, big], "landscape").map((c) => c.providerId)).toEqual(["b", "s"]);
    expect(pickBest([small, tall, big], "portrait").map((c) => c.providerId)).toEqual(["t"]);
  });
  it("caches successful searches, and does not cache a partial failure", async () => {
    const realFetch = globalThis.fetch;
    let calls = 0, fail = true;
    globalThis.fetch = (async (url: string) => {
      calls++;
      if (String(url).includes("pixabay") && fail) return new Response("slow down", { status: 429 });
      return new Response(JSON.stringify(String(url).includes("pixabay") ? { hits: [] } : { photos: [] }), { status: 200 });
    }) as typeof fetch;
    try {
      const env = { PEXELS_API_KEY: "k", PIXABAY_API_KEY: "k" };
      const opts = { query: `cache-test-${Math.random()}`, kind: "photo" as const, orientation: "landscape" as const };
      const first = await searchAssets(opts, env);
      expect(first.providers.find((p) => p.provider === "pixabay")!.error).toMatch(/rate limit/);
      await searchAssets(opts, env);
      expect(calls).toBe(6); // 3 providers x 2 searches: the failed one was not cached
      fail = false;
      await searchAssets(opts, env); // now succeeds and is cached
      const before = calls;
      await searchAssets(opts, env);
      expect(calls).toBe(before);
    } finally { globalThis.fetch = realFetch; }
  });
  it("sceneFieldsFromAsset copies source and licence into the scene", () => {
    const f = sceneFieldsFromAsset({ id: "a1", provider: "commons", kind: "image", credit: "X / Wikimedia Commons / CC BY 4.0", license: "CC BY 4.0", pageUrl: "https://commons.wikimedia.org/wiki/File:x.jpg", width: 1600, height: 900, durationSeconds: null });
    expect(f).toMatchObject({ assetId: "a1", assetType: "image", assetProvider: "commons", assetLicense: "CC BY 4.0" });
  });
});

describe("sniffType", () => {
  it("identifies files by their bytes", () => {
    expect(sniffType(PNG)?.mime).toBe("image/png");
    expect(sniffType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniffType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))?.mime).toBe("image/webp");
    expect(sniffType(MP4)?.mime).toBe("video/mp4");
  });
  it("rejects HTML and other content", () => {
    expect(sniffType(Buffer.from("<!DOCTYPE html><html>"))).toBeNull();
    expect(sniffType(Buffer.alloc(4))).toBeNull();
  });
});

describe("downloadToFile (against a local test server)", () => {
  async function withServer(run: (base: string, dir: string) => Promise<void>) {
    const server = http.createServer((req, res) => {
      if (req.url === "/img.png") { res.writeHead(200, { "Content-Type": "image/png" }); return void res.end(PNG); }
      if (req.url === "/vid.mp4") { res.writeHead(200, { "Content-Type": "video/mp4" }); return void res.end(MP4); }
      if (req.url === "/redir") { res.writeHead(302, { Location: "/img.png" }); return void res.end(); }
      if (req.url === "/evil-redir") { res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" }); return void res.end(); }
      if (req.url === "/loop") { res.writeHead(302, { Location: "/loop" }); return void res.end(); }
      if (req.url === "/html") { res.writeHead(200, { "Content-Type": "image/png" }); return void res.end("<html>Not an image</html>"); }
      res.writeHead(404); res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const dir = await mkdtemp(path.join(tmpdir(), "vs-dl-"));
    try { await run(base, dir); } finally { server.close(); await rm(dir, { recursive: true, force: true }); }
  }
  const local = (base: string) => (u: string) => u.startsWith(base);

  it("downloads, hashes and identifies an image", async () => {
    await withServer(async (base, dir) => {
      const d = await downloadToFile(`${base}/img.png`, { dir, kind: "image", isAllowed: local(base) });
      expect(d.type.mime).toBe("image/png");
      expect(d.bytes).toBe(PNG.length);
      expect(d.sha256).toBe(createHash("sha256").update(PNG).digest("hex"));
    });
  });
  it("downloads an mp4 as a video", async () => {
    await withServer(async (base, dir) => { expect((await downloadToFile(`${base}/vid.mp4`, { dir, kind: "video", isAllowed: local(base) })).type.kind).toBe("video"); });
  });
  it("follows redirects only to allowed addresses", async () => {
    await withServer(async (base, dir) => {
      expect((await downloadToFile(`${base}/redir`, { dir, kind: "image", isAllowed: local(base) })).type.mime).toBe("image/png");
      await expect(downloadToFile(`${base}/evil-redir`, { dir, kind: "image", isAllowed: local(base) })).rejects.toBeInstanceOf(DownloadError);
      await expect(downloadToFile(`${base}/loop`, { dir, kind: "image", isAllowed: local(base) })).rejects.toThrow(/redirects/);
    });
  });
  it("refuses a disallowed address before connecting", async () => {
    await withServer(async (_b, dir) => { await expect(downloadToFile("https://example.com/a.jpg", { dir, kind: "image" })).rejects.toThrow(/allowed stock provider/); });
  });
  it("rejects a page served as an image, a wrong kind, and oversize files, leaving no temp files behind", async () => {
    await withServer(async (base, dir) => {
      await expect(downloadToFile(`${base}/html`, { dir, kind: "image", isAllowed: local(base) })).rejects.toThrow(/not a valid image/);
      await expect(downloadToFile(`${base}/vid.mp4`, { dir, kind: "image", isAllowed: local(base) })).rejects.toThrow(/not a valid image/);
      await expect(downloadToFile(`${base}/img.png`, { dir, kind: "image", maxBytes: 100, isAllowed: local(base) })).rejects.toThrow(/larger than/);
      await expect(downloadToFile(`${base}/missing`, { dir, kind: "image", isAllowed: local(base) })).rejects.toThrow(/HTTP 404/);
      expect(await readdir(dir)).toEqual([]);
    });
  });
});
