"use client";
import { useEffect, useRef, useState } from "react";
import type { Scene } from "@/remotion/schemas/vidscriptSchema";
import type { CaptionCue } from "@/lib/captions/parse";
import { formatDuration } from "@/lib/timing/duration";

type Props = {
  scenes: Scene[];
  selected: number;
  onSelect: (index: number) => void;
  onMoveBoundary: (index: number, seconds: number) => void;
  /** Timeline width in seconds; defaults to the end of the last scene. Use max(scenes, voiceover) to see misalignment. */
  domainSeconds?: number;
  peaks?: number[] | null;
  voiceoverSeconds?: number | null;
  cues?: CaptionCue[];
};

const TICK_STEPS = [5, 10, 15, 30, 60, 120, 300];
const WAVE_H = 52, CUE_H = 14, TRACKS_H = WAVE_H + CUE_H + 6;

/** Waveform (top) and Lafzaly cue marks (bottom), drawn on one canvas aligned with the scene blocks below. */
function Tracks({ domain, peaks, voiceoverSeconds, cues }: { domain: number; peaks: number[] | null | undefined; voiceoverSeconds: number | null | undefined; cues: CaptionCue[] | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = width * dpr;
    el.height = TRACKS_H * dpr;
    const ctx = el.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, TRACKS_H);
    if (peaks && voiceoverSeconds) {
      ctx.fillStyle = "rgba(42,143,203,0.85)";
      const endX = Math.min(width, (voiceoverSeconds / domain) * width);
      for (let x = 0; x < endX; x += 2) {
        const amp = peaks[Math.min(peaks.length - 1, Math.floor((x / endX) * peaks.length))] ?? 0;
        const h = Math.max(1, amp * WAVE_H);
        ctx.fillRect(x, (WAVE_H - h) / 2, 1.5, h);
      }
    }
    if (cues) {
      ctx.fillStyle = "rgba(242,140,26,0.85)";
      for (const c of cues) {
        const x0 = (c.startMs / 1000 / domain) * width, x1 = (c.endMs / 1000 / domain) * width;
        ctx.fillRect(x0, WAVE_H + 6, Math.max(1, x1 - x0 - 1), CUE_H);
      }
    }
  }, [width, domain, peaks, voiceoverSeconds, cues]);

  return <canvas ref={ref} style={{ width: "100%", height: TRACKS_H, display: "block" }} aria-label="Voiceover waveform and caption cues" />;
}

export function SceneTimeline({ scenes, selected, onSelect, onMoveBoundary, domainSeconds, peaks, voiceoverSeconds, cues }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const domain = Math.max(domainSeconds ?? 0, scenes[scenes.length - 1]?.endSeconds ?? 1);
  const tickStep = TICK_STEPS.find((s) => domain / s <= 12) ?? 600;
  const ticks = Array.from({ length: Math.floor(domain / tickStep) + 1 }, (_, i) => i * tickStep);
  const hasTracks = Boolean(peaks) || Boolean(cues && cues.length);

  function startDrag(e: React.PointerEvent, index: number) {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      onMoveBoundary(index, ((ev.clientX - rect.left) / rect.width) * domain);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="select-none">
      <div className="relative h-5 text-xs text-white/50">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / domain) * 100}%` }}>{formatDuration(t)}</span>
        ))}
      </div>
      {hasTracks ? (
        <div className="mb-1 rounded-lg bg-navy-950">
          <Tracks domain={domain} peaks={peaks} voiceoverSeconds={voiceoverSeconds} cues={cues} />
        </div>
      ) : null}
      <div ref={trackRef} className="relative h-20 rounded-lg bg-navy-900">
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(i)}
            title={`${s.title} · ${s.startSeconds.toFixed(2)}s to ${s.endSeconds.toFixed(2)}s (${(s.endSeconds - s.startSeconds).toFixed(2)}s)`}
            className={`absolute top-1 bottom-1 overflow-hidden rounded-md border px-2 text-left text-xs ${i === selected ? "border-brand-orange bg-brand-blue/50" : "border-white/10 bg-brand-blue/25 hover:bg-brand-blue/35"}`}
            style={{ left: `${(s.startSeconds / domain) * 100}%`, width: `calc(${((s.endSeconds - s.startSeconds) / domain) * 100}% - 2px)` }}
          >
            <div className="truncate font-semibold">{i + 1}. {s.title}</div>
            <div className="truncate text-white/60">{s.type} · {(s.endSeconds - s.startSeconds).toFixed(1)}s</div>
          </button>
        ))}
        {scenes.slice(0, -1).map((s, i) => (
          <div
            key={`h-${s.id}`}
            role="separator"
            aria-label={`Drag boundary between scene ${i + 1} and ${i + 2}`}
            onPointerDown={(e) => startDrag(e, i)}
            className="absolute top-0 bottom-0 z-10 w-3 -translate-x-1/2 cursor-col-resize"
            style={{ left: `${(s.endSeconds / domain) * 100}%` }}
          >
            <div className="mx-auto h-full w-1 rounded bg-brand-orange/80" />
          </div>
        ))}
      </div>
    </div>
  );
}
