/** Vertical track that fills as `progress` (0..1) advances. */
export const ProgressIndicator: React.FC<{ progress: number; color: string; track: string; height: number }> = ({ progress, color, track, height }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 6, height, background: track, borderRadius: 3 }}>
    <div style={{ width: "100%", height: `${Math.min(1, Math.max(0, progress)) * 100}%`, background: color, borderRadius: 3 }} />
  </div>
);
