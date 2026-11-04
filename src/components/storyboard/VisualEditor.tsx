"use client";
import { useState } from "react";
import { visualSchema, type Visual } from "@/remotion/schemas/vidscriptSchema";

const box = "mt-1 w-full rounded-lg border border-white/10 bg-navy-950 p-2 text-sm";
const label = "mt-3 block text-xs text-white/60";
const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

/** Fields commit on blur, so half-typed lines never corrupt the plan. */
function Lines({ value, rows = 4, onCommit }: { value: string; rows?: number; onCommit: (text: string) => void }) {
  return <textarea defaultValue={value} rows={rows} className={box} onBlur={(e) => onCommit(e.target.value)} />;
}

export function VisualEditor({ visual, onChange }: { visual: Visual; onChange: (v: Visual) => void }) {
  const [jsonError, setJsonError] = useState<string | null>(null);

  switch (visual.kind) {
    case "bulletList":
    case "checklist":
      return <><span className={label}>Items (one per line, max 5)</span><Lines value={visual.items.join("\n")} onCommit={(t) => onChange({ ...visual, items: lines(t).slice(0, 5) })} /></>;
    case "stepDiagram":
      return <><span className={label}>Steps (one per line, 3 to 6)</span><Lines value={visual.steps.map((s) => s.label).join("\n")} onCommit={(t) => onChange({ ...visual, steps: lines(t).slice(0, 6).map((l, i) => ({ label: l, detail: visual.steps[i]?.detail ?? null })) })} /></>;
    case "statCallout":
      return (
        <>
          <span className={label}>Big number or value</span><input className={box} defaultValue={visual.value} onBlur={(e) => onChange({ ...visual, value: e.target.value })} />
          <span className={label}>Label</span><input className={box} defaultValue={visual.label} onBlur={(e) => onChange({ ...visual, label: e.target.value })} />
          <span className={label}>Context (optional)</span><input className={box} defaultValue={visual.context ?? ""} onBlur={(e) => onChange({ ...visual, context: e.target.value || null })} />
        </>
      );
    case "quoteCard":
      return (
        <>
          <span className={label}>Quote</span><textarea rows={3} className={box} defaultValue={visual.quote} onBlur={(e) => onChange({ ...visual, quote: e.target.value })} />
          <span className={label}>Attribution (optional)</span><input className={box} defaultValue={visual.attribution ?? ""} onBlur={(e) => onChange({ ...visual, attribution: e.target.value || null })} />
        </>
      );
    case "imageWithCaption":
      return <><span className={label}>Caption</span><input className={box} defaultValue={visual.caption} onBlur={(e) => onChange({ ...visual, caption: e.target.value })} /></>;
    case "callToAction":
      return (
        <>
          <span className={label}>Text</span><input className={box} defaultValue={visual.text} onBlur={(e) => onChange({ ...visual, text: e.target.value })} />
          <span className={label}>URL (optional)</span><input className={box} defaultValue={visual.url ?? ""} onBlur={(e) => onChange({ ...visual, url: e.target.value || null })} />
        </>
      );
    case "lineChart":
    case "barChart":
    case "donutChart":
      return (
        <>
          <span className={label}>Data points, one per line as "label: value" (at least 2)</span>
          <Lines
            value={visual.data.map((d) => `${d.label}: ${d.value}`).join("\n")}
            onCommit={(t) => {
              const data = lines(t).flatMap((l) => {
                const i = l.lastIndexOf(":");
                const value = Number(l.slice(i + 1));
                return i > 0 && Number.isFinite(value) ? [{ label: l.slice(0, i).trim(), value }] : [];
              });
              onChange({ ...visual, data });
            }}
          />
        </>
      );
    default:
      // timeline, twoColumnComparison and the map kinds: validated JSON editor for now.
      return (
        <>
          <span className={label}>Visual data (JSON, validated when you click away)</span>
          <textarea
            rows={8}
            className={`${box} font-mono`}
            defaultValue={JSON.stringify(visual, null, 2)}
            onBlur={(e) => {
              try {
                const parsed = visualSchema.safeParse(JSON.parse(e.target.value));
                if (!parsed.success) return setJsonError(parsed.error.issues[0]?.message ?? "Invalid visual");
                setJsonError(null);
                onChange(parsed.data);
              } catch { setJsonError("Not valid JSON"); }
            }}
          />
          {jsonError ? <p className="text-xs text-red-400">{jsonError}</p> : null}
        </>
      );
  }
}
