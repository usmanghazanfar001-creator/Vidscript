"use client";
import { useRef, useState } from "react";
import { ALLOWED_AUDIO_EXTENSIONS, MAX_VOICEOVER_BYTES, audioExtension, compareDurations, formatBytes } from "@/lib/audio/voiceover";
import { measureInBrowser } from "@/lib/audio/clientDuration";
import { formatDuration } from "@/lib/timing/duration";

export type VoiceoverView = { fileName: string; sizeBytes: number; durationSeconds: number; uploadedAt: string; url: string };

function upload(url: string, file: File, onProgress: (pct: number) => void): Promise<VoiceoverView> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: { voiceover?: VoiceoverView; error?: string } = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      xhr.status >= 200 && xhr.status < 300 && data.voiceover ? resolve(data.voiceover) : reject(new Error(data.error ?? `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Please retry."));
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

export function VoiceoverPanel({ projectId, initial, storyboardSeconds, onChange }: { projectId: string; initial: VoiceoverView | null; storyboardSeconds: number | null; onChange?: (v: VoiceoverView | null) => void }) {
  const [voiceover, setVoiceover] = useState(initial);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!audioExtension(file.name)) return setError(`Unsupported file type. Use ${ALLOWED_AUDIO_EXTENSIONS.join(", ")}.`);
    if (file.size > MAX_VOICEOVER_BYTES) return setError("File is too large (limit 300 MB).");
    if (voiceover && !window.confirm("Replace the current voiceover? Scene timings you aligned to it may no longer match.")) return;
    setProgress(0);
    try {
      const hint = await measureInBrowser(file);
      const qs = new URLSearchParams({ name: file.name, ...(hint ? { durationHint: String(hint) } : {}) });
      const uploaded = await upload(`/api/projects/${projectId}/voiceover?${qs}`, file, setProgress);
      setVoiceover(uploaded);
      onChange?.(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!window.confirm("Remove the voiceover from this project?")) return;
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/voiceover`, { method: "DELETE" });
    if (res.ok) { setVoiceover(null); onChange?.(null); } else setError("Could not remove the voiceover. Please retry.");
  }

  const cmp = voiceover && storyboardSeconds ? compareDurations(storyboardSeconds, voiceover.durationSeconds) : null;

  return (
    <section className="mt-12 rounded-2xl border border-white/10 bg-navy-900 p-5">
      <h2 className="text-lg font-semibold">Voiceover</h2>
      <p className="mt-1 text-sm text-white/60">Upload your finished voiceover (MP3, WAV, M4A or AAC). Its real length becomes the master timeline for the final render.</p>

      {voiceover ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm"><span className="font-semibold">{voiceover.fileName}</span> · {formatBytes(voiceover.sizeBytes)} · {voiceover.durationSeconds.toFixed(2)}s ({formatDuration(voiceover.durationSeconds)}) · uploaded {new Date(voiceover.uploadedAt).toLocaleString()}</p>
          <audio controls preload="metadata" src={`${voiceover.url}?v=${encodeURIComponent(voiceover.uploadedAt)}`} className="w-full" />
          {cmp ? (
            <p className={`text-sm ${cmp.withinTolerance ? "text-emerald-400" : "text-brand-orange"}`}>
              {cmp.withinTolerance
                ? `Your storyboard (${storyboardSeconds!.toFixed(1)}s) already matches the voiceover within 3 seconds.`
                : `Your voiceover is ${Math.abs(cmp.deltaSeconds).toFixed(1)}s (${Math.abs(cmp.percent).toFixed(1)}%) ${cmp.direction} than your storyboard (${storyboardSeconds!.toFixed(1)}s). Scenes will need aligning to the real audio; the alignment tools are a later build step.`}
            </p>
          ) : null}
        </div>
      ) : <p className="mt-4 text-sm text-white/50">No voiceover uploaded yet.</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={input} type="file" accept={ALLOWED_AUDIO_EXTENSIONS.join(",")} className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        <button type="button" disabled={progress !== null} onClick={() => input.current?.click()} className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold disabled:opacity-40">
          {progress !== null ? `Uploading… ${progress}%` : voiceover ? "Replace voiceover" : "Upload voiceover"}
        </button>
        {voiceover ? <>
          <a href={`${voiceover.url}?download=1`} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Download</a>
          <button type="button" onClick={remove} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Remove</button>
        </> : null}
      </div>
      {progress !== null ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-950"><div className="h-full bg-brand-orange transition-all" style={{ width: `${progress}%` }} /></div> : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </section>
  );
}
