export const defaultBrand = {
  primaryColor: "#2A8FCB",
  accentColor: "#F28C1A",
  backgroundColor: "#041E42",
  textColor: "#FFFFFF",
  fontFamily: "Inter, system-ui, sans-serif",
  logoUrl: null,
  watermarkUrl: null,
} as const;

export const defaultCaptionStyle = {
  enabled: true,
  position: "bottom" as const,
  fontSize: 54,
  textColor: "#FFFFFF",
  backgroundColor: "rgba(0,0,0,0.6)",
  outlineColor: null,
  maxLines: 2 as const,
};
