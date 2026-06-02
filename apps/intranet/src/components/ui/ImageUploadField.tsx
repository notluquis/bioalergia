import { Button, Label } from "@heroui/react";
import { Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { imagesORPCClient } from "@/features/catalog/orpc-images";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

type ImageUploadFieldProps = {
  /** Carpeta lógica en R2 (whitelisteada en el server). */
  target: "campaign" | "category";
  /** URL actual (controlado). Vacío = sin imagen. */
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
};

/**
 * Campo de imagen que sube a R2 (presign → PUT directo) y devuelve la CDN URL.
 * Reemplaza el input de texto de URL manual. Reutilizable (campañas, categorías).
 */
export function ImageUploadField({ target, value, onChange, label, hint }: ImageUploadFieldProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toastError(`Tipo no permitido: ${file.type}`);
      return;
    }
    if (file.size > MAX_BYTES) {
      toastError(`Imagen mayor a 5MB`);
      return;
    }
    setBusy(true);
    try {
      const presign = await imagesORPCClient.presignImage({
        target,
        filename: file.name,
        content_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/avif",
      });
      const put = await fetch(presign.data.url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error(`Subida a R2 falló: ${put.status}`);
      onChange(presign.data.cdn_url);
      toastSuccess("Imagen subida");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error subiendo imagen");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <div className="flex h-28 items-center justify-center rounded-xl border border-default-200 border-dashed bg-default-50 p-2">
        {value ? (
          <img
            alt={label ?? "Imagen"}
            className="max-h-full max-w-full object-contain"
            src={value}
          />
        ) : (
          <ImageIcon className="size-8 text-default-300" />
        )}
      </div>
      {hint ? <p className="text-default-500 text-xs">{hint}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          isPending={busy}
          onPress={() => inputRef.current?.click()}
        >
          <Upload size={14} /> {value ? "Reemplazar" : "Subir imagen"}
        </Button>
        {value ? (
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            className="text-danger"
            aria-label="Quitar imagen"
            onPress={() => onChange("")}
          >
            <Trash2 size={14} />
          </Button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        aria-label={label ?? "Subir imagen"}
        accept="image/png,image/jpeg,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
