// Optimización de imágenes 100% client-side (canvas) antes de subir a R2:
// redimensiona al borde máximo y re-codifica a WebP. Sin servicios pagos, sin
// dependencias, sin cómputo en el servidor. Los navegadores 2026 soportan WebP
// de forma universal, así que el `cdn_url` resultante se sirve directo.

export type OptimizedImage = {
  blob: Blob;
  filename: string;
  contentType: string;
  width: number;
  height: number;
};

function passthrough(file: File, width: number, height: number): OptimizedImage {
  return { blob: file, filename: file.name, contentType: file.type, width, height };
}

export async function optimizeImageForUpload(
  file: File,
  opts?: { maxEdge?: number; quality?: number }
): Promise<OptimizedImage> {
  const maxEdge = opts?.maxEdge ?? 1600;
  const quality = opts?.quality ?? 0.82;

  // SVG/GIF u otros que no conviene rasterizar → subir tal cual.
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
    return passthrough(file, 0, 0);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return passthrough(file, 0, 0);
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return passthrough(file, bitmap.width, bitmap.height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
  if (!blob || blob.size >= file.size) {
    // Si WebP no quedó más chico (raro), conservar el original.
    return passthrough(file, width, height);
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  return { blob, filename: `${base}.webp`, contentType: "image/webp", width, height };
}

export type ImageVariant = { width: number; blob: Blob; filename: string; contentType: string };

/**
 * Genera variantes WebP responsivas (400/800/1600w, capadas al ancho nativo y a
 * 1600) para `srcset`. Todo client-side (canvas) → sin servicios pagos. El
 * navegador baja sólo el tamaño que necesita.
 */
export async function generateImageVariants(
  file: File,
  opts?: { widths?: number[]; cap?: number; quality?: number }
): Promise<{ variants: ImageVariant[]; intrinsic: { width: number; height: number } } | null> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const cap = Math.min(bitmap.width, opts?.cap ?? 1600);
  const aspect = bitmap.height / bitmap.width;
  const requested = opts?.widths ?? [400, 800, 1600];
  const widths = [...new Set(requested.filter((w) => w < cap).concat(cap))].sort((a, b) => a - b);
  const quality = opts?.quality ?? 0.82;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const variants: ImageVariant[] = [];
  for (const w of widths) {
    const h = Math.max(1, Math.round(w * aspect));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
    if (blob) {
      variants.push({ width: w, blob, filename: `${base}-${w}w.webp`, contentType: "image/webp" });
    }
  }
  const intrinsic = { width: cap, height: Math.max(1, Math.round(cap * aspect)) };
  bitmap.close();
  return variants.length ? { variants, intrinsic } : null;
}
