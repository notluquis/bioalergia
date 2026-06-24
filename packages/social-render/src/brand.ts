// Bioalergia brand tokens (concrete colors for Satori — it can't read CSS vars).
// Mirrors packages/theme/bioalergia.css (OKLch primitives) as sRGB hex.
export const BRAND = {
  cream: "#f7f3ea", // background
  mist: "#e9f0f4",
  ink: "#0f1c26", // foreground / text
  amber: "#f4a72b", // accent / primary action
  amberStrong: "#e0901a",
  blue: "#126cba",
  blueSoft: "#4a93d6",
  white: "#ffffff",
  fontFamily: "IBM Plex Sans",
} as const;
