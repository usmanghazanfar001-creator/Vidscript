"use client";
import { useState } from "react";
import type { Scene } from "@/remotion/schemas/vidscriptSchema";
import { CLEARED_ASSET_FIELDS, PROVIDER_LABELS, type Candidate, type Orientation, type SceneAssetFields, type WantedKind } from "@/lib/assets/types";

type SearchResponse = { candidates: Candidate[]; providers: Array<{ provider: string; ok: boolean; error?: string }>; configured: string[]; error?: string };
type AutoResponse = { found: boolean; fields?: SceneAssetFields; message?: string; source?: string; error?: string };

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

const box = "mt-1 w-full rounded-lg border border-white/10 bg-navy-950 p-2 text-sm";
const label = "mt-3 block text-xs text-white/60";

/** Pick or replace a scene's real photo/clip: search the free stock providers, or let the app choose the best match. */
export function AssetPicker({ scene, orientation = "landscape", onChange }: { scene: Scene; orientation?: Orientation; onChange: (patch: Partial<Scene>) => void }) {
  const [query, setQuery] = useState(scene.assetQuery ?? "");
  const [kind, setKind] = useState<WantedKind>(scene.assetPreference === "video" ? "video" : "photo");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState<"search" | "auto" | string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const q = query.trim();
  const apply = (fields: SceneAssetFields) => onChange({ ...fields, assetQuery: q || scene.assetQuery, assetPreference: kind });

  async function search() {
    setBusy("search"); setNote(null);
    try {
      const r = await post<SearchResponse>("/api/assets/search", { query: q, kind, orientation });
      setResults(r);
      const problems = r.providers.filter((p) => !p.ok).map((p) => p.error);
      if (r.candidates.length === 0) setNote({ kind: "error", text: `Nothing found for "${q}".${problems.length ? ` ${problems.join("; ")}.` : ""}${r.configured.length === 0 ? " Video search needs a Pexels or Pixabay API key in .env." : ""}` });
      else if (problems.length) setNote({ kind: "error", text: `${problems.join("; ")}.` });
    } catch (e) { setNote({ kind: "error", text: e instanceof Error ? e.message : "Search failed" }); } finally { setBusy(null); }
  }

  async function auto() {
    setBusy("auto"); setNote(null);
    try {
      const r = await post<AutoResponse>("/api/assets/auto", { query: q, kind, orientation });
      if (r.found && r.fields) { apply(r.fields); setNote({ kind: "ok", text: `Added from ${r.source}.` }); } else setNote({ kind: "error", text: r.message ?? "Nothing found." });
    } catch (e) { setNote({ kind: "error", text: e instanceof Error ? e.message : "Search failed" }); } finally { setBusy(null); }
  }

  async function choose(c: Candidate) {
    const id = `${c.provider}:${c.providerId}`;
    setBusy(id); setNote(null);
    try {
      const r = await post<{ fields: SceneAssetFields }>("/api/assets/fetch", { candidate: c, query: q });
      apply(r.fields);
      setNote({ kind: "ok", text: `Using the ${c.kind === "video" ? "clip" : "photo"} from ${PROVIDER_LABELS[c.provider]}.` });
    } catch (e) { setNote({ kind: "error", text: e instanceof Error ? e.message : "Download failed" }); } finally { setBusy(null); }
  }

  const src = scene.assetId ? `/api/assets/${scene.assetId}/file` : null;

  return (
    <div className="mt-5 rounded-xl border border-white/10 p-4">
      <h4 className="text-sm font-semibold">Real photo or footage</h4>

      {src ? (
        <div className="mt-3 flex gap-3">
          {scene.assetType === "video"
            // eslint-disable-next-line jsx-a11y/media-has-caption
            ? <video src={src} muted controls preload="metadata" className="h-24 w-40 rounded-lg bg-black object-cover" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={src} alt="" className="h-24 w-40 rounded-lg object-cover" />}
          <div className="min-w-0 text-xs text-white/70">
            <p className="break-words">{scene.assetCredit}</p>
            <p className="mt-1">Licence: {scene.assetLicense}</p>
            {scene.assetSourceUrl ? <a href={scene.assetSourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brand-blue underline">Source page</a> : null}
            <button type="button" onClick={() => onChange({ ...CLEARED_ASSET_FIELDS })} className="ml-3 underline">Remove</button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-white/50">No stock visual yet. The scene shows its plain animated background.</p>
      )}

      <span className={label}>Search phrase</span>
      <input className={box} value={query} placeholder="e.g. tokyo skyline night" onChange={(e) => setQuery(e.target.value)} />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <select className="rounded-lg border border-white/10 bg-navy-950 p-2" value={kind} onChange={(e) => setKind(e.target.value as WantedKind)}>
          <option value="photo">Photo</option>
          <option value="video">Video clip</option>
        </select>
        <button type="button" onClick={search} disabled={q.length < 2 || busy !== null} className="rounded-lg border border-white/20 px-3 py-2 hover:bg-white/10 disabled:opacity-40">{busy === "search" ? "Searching…" : "Search"}</button>
        <button type="button" onClick={auto} disabled={q.length < 2 || busy !== null} className="rounded-lg bg-brand-blue px-3 py-2 font-semibold disabled:opacity-40">{busy === "auto" ? "Finding…" : "Pick best match"}</button>
      </div>
      {note ? <p className={`mt-2 text-xs ${note.kind === "error" ? "text-red-400" : "text-emerald-400"}`}>{note.text}</p> : null}

      {results && results.candidates.length > 0 ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {results.candidates.slice(0, 12).map((c) => {
            const id = `${c.provider}:${c.providerId}`;
            return (
              <button key={id} type="button" onClick={() => choose(c)} disabled={busy !== null} className="overflow-hidden rounded-lg border border-white/10 text-left hover:border-brand-orange disabled:opacity-50">
                {c.previewType === "video"
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  ? <video src={c.previewUrl} muted preload="metadata" className="h-24 w-full bg-black object-cover" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={c.previewUrl} alt="" loading="lazy" className="h-24 w-full object-cover" />}
                <div className="p-2 text-xs text-white/70">
                  <div>{busy === id ? "Downloading…" : `via ${PROVIDER_LABELS[c.provider]}`}</div>
                  <div className="text-white/40">{c.width}×{c.height}{c.durationSeconds ? ` · ${Math.round(c.durationSeconds)}s` : ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
