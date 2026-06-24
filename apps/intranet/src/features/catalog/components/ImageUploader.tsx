import { Button, Card, Spinner } from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { confirmAction } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { imagesORPCClient } from "../orpc-images";
import { catalogKeys } from "../queries";

type ExistingImage = {
  id: number;
  cdn_url: string;
  srcset?: string | null;
  avif_srcset?: string | null;
  jxl_srcset?: string | null;
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
      // Sube el ORIGINAL a R2; el servidor genera las variantes responsivas
      // next-gen (WebP + AVIF + JXL) con sharp. Encoder confiable para todos
      // los formatos — a diferencia del canvas, que no codifica AVIF en Safari.
      const presign = await imagesORPCClient.presignUpload({
        product_id: productId,
        filename: file.name,
        content_type: file.type as AllowedType,
      });
      const res = await fetch(presign.data.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error(`R2 PUT falló: ${res.status}`);
      await imagesORPCClient.confirmUpload({
        product_id: productId,
        r2_key: presign.data.r2_key,
        cdn_url: presign.data.cdn_url,
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
                  <picture className="contents">
                    {img.jxl_srcset ? (
                      <source
                        type="image/jxl"
                        srcSet={img.jxl_srcset}
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : null}
                    {img.avif_srcset ? (
                      <source
                        type="image/avif"
                        srcSet={img.avif_srcset}
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : null}
                    {img.srcset ? (
                      <source
                        type="image/webp"
                        srcSet={img.srcset}
                        sizes="(max-width: 640px) 50vw, 200px"
                      />
                    ) : null}
                    <img
                      alt={img.alt ?? ""}
                      className="object-cover size-full"
                      loading="lazy"
                      decoding="async"
                      src={img.cdn_url}
                    />
                  </picture>
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
