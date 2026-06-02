import { Button, Card, Spinner } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { optimizeImageForUpload } from "@/lib/image-optimize";
import { imagesORPCClient } from "../orpc-images";
import { catalogKeys } from "../queries";

type ExistingImage = {
  id: number;
  cdn_url: string;
  is_primary: boolean;
  alt: string | null;
};

interface ImageUploaderProps {
  productId: number;
  images: ExistingImage[];
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
type AllowedType = (typeof ALLOWED)[number];
const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploader({ productId, images }: ImageUploaderProps) {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const setPrimaryMutation = useMutation({
    mutationFn: (id: number) => imagesORPCClient.setPrimary({ id }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => imagesORPCClient.deleteImage({ id }),
  });

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: catalogKeys.all });
  }

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type as AllowedType)) {
      toastError(`Tipo no permitido: ${file.type}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toastError(`Imagen >5MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    setUploading(true);
    try {
      // Optimiza client-side (resize + WebP) antes de subir — menos peso en R2
      // y CDN, carga más rápida en la tienda. Sin servicios pagos.
      const opt = await optimizeImageForUpload(file);
      const presign = await imagesORPCClient.presignUpload({
        product_id: productId,
        filename: opt.filename,
        content_type: opt.contentType as AllowedType,
      });
      const putRes = await fetch(presign.data.url, {
        method: "PUT",
        body: opt.blob,
        headers: { "Content-Type": opt.contentType },
      });
      if (!putRes.ok) {
        throw new Error(`R2 PUT falló: ${putRes.status}`);
      }
      const dims =
        opt.width > 0 ? { width: opt.width, height: opt.height } : await readImageDimensions(file);
      await imagesORPCClient.confirmUpload({
        product_id: productId,
        r2_key: presign.data.r2_key,
        cdn_url: presign.data.cdn_url,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      });
      toastSuccess("Imagen subida");
      invalidate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error subiendo imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleSetPrimary(id: number) {
    try {
      await setPrimaryMutation.mutateAsync(id);
      invalidate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "No se pudo marcar principal");
    }
  }

  async function handleDelete(id: number) {
    const ok = await confirmAction({
      title: "¿Borrar esta imagen?",
      variant: "danger",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(id);
      invalidate();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "No se pudo borrar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button isDisabled={uploading} onPress={() => inputRef.current?.click()} variant="outline">
          {uploading ? <Spinner size="sm" /> : <Upload size={16} />}
          {uploading ? "Subiendo..." : "Subir imagen"}
        </Button>
        <span className="text-foreground/60 text-xs">JPEG/PNG/WebP/AVIF — máx 5MB</span>
        <input
          accept={ALLOWED.join(",")}
          aria-label="Subir imagen"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
          ref={inputRef}
          type="file"
        />
      </div>

      {images.length === 0 ? (
        <Card variant="secondary">
          <Card.Content className="py-6 text-center text-foreground/60 text-sm">
            Sin imágenes todavía. La primera que subas se marca como principal.
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img) => (
            <Card key={img.id} variant="secondary">
              <Card.Content className="p-0">
                <div className="relative aspect-square overflow-hidden rounded-t-[18px] bg-foreground/5">
                  <img
                    alt={img.alt ?? ""}
                    className="object-cover size-full"
                    loading="lazy"
                    src={img.cdn_url}
                  />
                  {img.is_primary && (
                    <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
                      Principal
                    </span>
                  )}
                </div>
              </Card.Content>
              <Card.Footer className="flex gap-1 p-2">
                <Button
                  className="flex-1"
                  isDisabled={img.is_primary}
                  onPress={() => {
                    void handleSetPrimary(img.id);
                  }}
                  size="sm"
                  variant="outline"
                >
                  <Star size={12} />
                </Button>
                <Button
                  onPress={() => {
                    void handleDelete(img.id);
                  }}
                  size="sm"
                  variant="danger-soft"
                >
                  <Trash2 size={12} />
                </Button>
              </Card.Footer>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
