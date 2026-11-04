import { AbsoluteFill, Img } from "remotion";
import type { VidscriptPlan } from "../schemas/vidscriptSchema";

export const BrandFrame: React.FC<{ brand: VidscriptPlan["brand"]; children: React.ReactNode }> = ({ brand, children }) => (
  <AbsoluteFill style={{ fontFamily: brand.fontFamily, color: brand.textColor }}>
    {children}
    {brand.watermarkUrl ? <Img src={brand.watermarkUrl} style={{ position: "absolute", right: 48, top: 40, height: 56, opacity: 0.6 }} /> : null}
  </AbsoluteFill>
);
