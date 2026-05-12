import { useEffect, useRef } from "react";

// Paints a small red badge with a count over the current favicon. When
// `count` returns to 0 the original favicon is restored. Uses canvas so
// there is no extra asset to ship; falls back silently on platforms
// that block favicon mutation (Safari currently allows it as of 17+).

const SELECTOR = "link[rel~='icon']";

function findFaviconLink(): HTMLLinkElement | null {
  const existing = document.querySelector<HTMLLinkElement>(SELECTOR);
  if (existing) return existing;
  const link = document.createElement("link");
  link.rel = "icon";
  document.head.appendChild(link);
  return link;
}

export function useFaviconBadge(count: number, badgeColor = "#dc2626") {
  const originalHref = useRef<string | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const link = findFaviconLink();
    if (!link) return;
    if (originalHref.current === null) originalHref.current = link.href;

    if (count <= 0) {
      if (originalHref.current) link.href = originalHref.current;
      return;
    }

    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (img: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, size, size);
      if (img) ctx.drawImage(img, 0, 0, size, size);
      const label = count > 99 ? "99+" : String(count);
      // Filled circle bottom-right
      const r = label.length <= 2 ? 10 : 12;
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(size - r, size - r, r, 0, Math.PI * 2);
      ctx.fill();
      // White count
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, size - r, size - r + 1);
      link.href = canvas.toDataURL("image/png");
    };

    const orig = originalHref.current;
    if (!orig) {
      draw(null);
      return;
    }
    if (!imageRef.current) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => draw(img);
      img.onerror = () => draw(null);
      img.src = orig;
      imageRef.current = img;
    } else if (imageRef.current.complete) {
      draw(imageRef.current);
    } else {
      imageRef.current.onload = () => draw(imageRef.current);
    }
  }, [count, badgeColor]);
}
