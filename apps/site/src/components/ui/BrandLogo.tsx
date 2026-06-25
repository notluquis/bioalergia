import { brandAsset } from "@/lib/assets";

/**
 * Bioalergia wordmark — colour mark on light themes, white knockout on dark.
 * Swap is CSS-only (`.logo-light` / `.logo-dark` toggled by data-theme in
 * index.css) so there's no hydration flash. Served from the R2 CDN.
 */
export function BrandLogo({
  className = "h-9 w-auto",
  eager = false,
}: {
  className?: string;
  eager?: boolean;
}) {
  const loading = eager ? "eager" : "lazy";
  return (
    <>
      <img
        alt="Bioalergia"
        className={`logo-light ${className}`}
        loading={loading}
        src={brandAsset("logo-bioalergia.png")}
      />
      <img
        alt="Bioalergia"
        className={`logo-dark ${className}`}
        loading={loading}
        src={brandAsset("logo-bioalergia-white.png")}
      />
    </>
  );
}
