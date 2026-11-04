"use client";
import { sceneTypeSchema, type Scene } from "@/remotion/schemas/vidscriptSchema";
import { TYPE_VISUALS, defaultVisual } from "@/lib/storyboard/typeVisuals";
import { VisualEditor } from "./VisualEditor";
import { AssetPicker } from "./AssetPicker";

const input = "mt-1 w-full rounded-lg border border-white/10 bg-navy-950 p-2 text-sm";
const label = "mt-3 block text-xs text-white/60";
const ANIMS = ["fade", "slide-up", "zoom-in", "reveal", "draw", "none"] as const;
const TRANS = ["fade", "slide", "wipe", "none"] as const;

type Props = {
  scene: Scene;
  index: number;
  isLast: boolean;
  onChange: (patch: Partial<Scene>) => void;
  onSplit: () => void;
  onMerge: () => void;
};

export function SceneEditor({ scene, index, isLast, onChange, onSplit, onMerge }: Props) {
  const dur = scene.endSeconds - scene.startSeconds;
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-900 p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Scene {index + 1}</h3>
        <div className="flex gap-2 text-sm">
          <button type="button" onClick={onSplit} className="rounded-lg border border-white/20 px-3 py-1 hover:bg-white/10">Split</button>
          <button type="button" onClick={onMerge} disabled={isLast} className="rounded-lg border border-white/20 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Merge with next</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/60">Start {scene.startSeconds.toFixed(2)}s · End {scene.endSeconds.toFixed(2)}s · Duration {dur.toFixed(2)}s</p>

      <span className={label}>Title</span>
      <input className={input} value={scene.title} onChange={(e) => onChange({ title: e.target.value })} />
      <span className={label}>Subtitle</span>
      <input className={input} value={scene.subtitle ?? ""} onChange={(e) => onChange({ subtitle: e.target.value || null })} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={label}>Scene type</span>
          <select
            className={input}
            value={scene.type}
            onChange={(e) => {
              const type = sceneTypeSchema.parse(e.target.value);
              const allowed = TYPE_VISUALS[type];
              onChange(allowed.includes(scene.visual.kind) ? { type } : { type, visual: defaultVisual(allowed[0]!) });
            }}
          >
            {sceneTypeSchema.options.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <span className={label}>Visual</span>
          <select className={input} value={scene.visual.kind} onChange={(e) => onChange({ visual: defaultVisual(e.target.value) })}>
            {TYPE_VISUALS[scene.type].map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
      </div>

      {/* key resets the uncontrolled fields when the selection or visual kind changes */}
      <div key={`${scene.id}-${scene.visual.kind}`}>
        <VisualEditor visual={scene.visual} onChange={(visual) => onChange({ visual })} />
      </div>

      <AssetPicker key={scene.id} scene={scene} onChange={onChange} />

      <div className="grid grid-cols-3 gap-3">
        <div><span className={label}>Animation</span><select className={input} value={scene.animation} onChange={(e) => onChange({ animation: e.target.value as Scene["animation"] })}>{ANIMS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><span className={label}>Transition in</span><select className={input} value={scene.transitionIn} onChange={(e) => onChange({ transitionIn: e.target.value as Scene["transitionIn"] })}>{TRANS.map((a) => <option key={a}>{a}</option>)}</select></div>
        <div><span className={label}>Transition out</span><select className={input} value={scene.transitionOut} onChange={(e) => onChange({ transitionOut: e.target.value as Scene["transitionOut"] })}>{TRANS.map((a) => <option key={a}>{a}</option>)}</select></div>
      </div>

      <span className={label}>Notes</span>
      <textarea rows={2} className={input} value={scene.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value || null })} />
      {scene.scriptExcerpt ? <p className="mt-3 text-xs italic text-white/50">Script: {scene.scriptExcerpt}</p> : null}
    </div>
  );
}
