import { useAppear } from "./anim";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

export const ComparisonCard: React.FC<{
  heading: string;
  points: string[];
  side: "left" | "right";
  color: string;
  brand: VidscriptPlan["brand"];
}> = ({ heading, points, side, color, brand }) => {
  const a = useAppear(14, 18);
  return (
    <div style={{ flex: 1, background: `${brand.textColor}10`, borderTop: `10px solid ${color}`, borderRadius: 20, padding: "40px 48px", opacity: a, transform: `translateX(${(side === "left" ? -1 : 1) * (1 - a) * 80}px)` }}>
      <div style={{ fontSize: 56, fontWeight: 800, color }}>{heading}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: "28px 0 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {points.map((pt, i) => <Point key={i} text={pt} index={i} brand={brand} />)}
      </ul>
    </div>
  );
};

const Point: React.FC<{ text: string; index: number; brand: VidscriptPlan["brand"] }> = ({ text, index, brand }) => {
  const a = useAppear(36 + index * 12, 12);
  return <li style={{ fontSize: 38, color: brand.textColor, opacity: a, transform: `translateY(${(1 - a) * 14}px)` }}>• {text}</li>;
};
