import { Button, Form } from "@heroui/react";
import { AlertTriangle, Images, Send } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { AppDateTimePicker } from "@/components/forms/AppDatePicker";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { uploadWaMedia } from "../hooks/useWaCloud";

export type CarouselCardState = {
  cardIndex: number;
  imageMediaId: string | null;
  imageFilename: string | null;
  bodyParams: string[];
};

export type CopyCodeState = { index: number; value: string } | null;

export function TemplateComposer({
  tplKey,
  setTplKey,
  tplOptions,
  tplVars,
  setTplVars,
  tplCards,
  setTplCards,
  tplLtoExpiration,
  setTplLtoExpiration,
  tplCopyCode,
  setTplCopyCode,
  hasLto,
  copyCodeButtonIndex,
  phoneId,
  isPending,
  onSend,
  onSwitchText,
}: {
  tplKey: string;
  setTplKey: (v: string) => void;
  tplOptions: { value: string; label: string }[];
  tplVars: string[];
  setTplVars: React.Dispatch<React.SetStateAction<string[]>>;
  tplCards: CarouselCardState[];
  setTplCards: React.Dispatch<React.SetStateAction<CarouselCardState[]>>;
  // Local datetime string (YYYY-MM-DDTHH:mm) for LTO expiration. Empty
  // when the template has no LIMITED_TIME_OFFER component.
  tplLtoExpiration: string;
  setTplLtoExpiration: (v: string) => void;
  // COPY_CODE button state. null when the template has no copy_code
  // button. The index lives in the template definition; the value is
  // operator-supplied at send time.
  tplCopyCode: CopyCodeState;
  setTplCopyCode: React.Dispatch<React.SetStateAction<CopyCodeState>>;
  hasLto: boolean;
  copyCodeButtonIndex: number | null;
  phoneId: string;
  isPending: boolean;
  onSend: () => void;
  onSwitchText?: () => void;
}) {
  // Aria-driven validation. The send button is gated by `isValid`
  // (computed below); each empty required slot also flags itself via
  // FieldError so the operator sees exactly what's missing instead of
  // a generic toast after Meta rejects the payload.
  const missingVars = useMemo(
    () => tplVars.reduce<number[]>((acc, v, i) => (v.trim() ? acc : [...acc, i]), []),
    [tplVars]
  );
  const missingCardImages = useMemo(
    () => tplCards.reduce<number[]>((acc, c, i) => (c.imageMediaId ? acc : [...acc, i]), []),
    [tplCards]
  );
  const missingCardVars = useMemo(
    () =>
      tplCards.flatMap((c, ci) =>
        c.bodyParams.flatMap((v, vi) => (v.trim() ? [] : [`${ci}.${vi}`]))
      ),
    [tplCards]
  );
  const ltoInvalid = hasLto && !tplLtoExpiration;
  const copyCodeInvalid = copyCodeButtonIndex !== null && !(tplCopyCode?.value ?? "").trim();
  const isValid =
    !!tplKey &&
    missingVars.length === 0 &&
    missingCardImages.length === 0 &&
    missingCardVars.length === 0 &&
    !ltoInvalid &&
    !copyCodeInvalid;

  return (
    <Form
      validationBehavior="aria"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValid) {
          toast.error("Completa todos los campos requeridos antes de enviar.");
          return;
        }
        onSend();
      }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SelectInput
            label="Plantilla aprobada"
            value={tplKey}
            onValueChange={setTplKey}
            options={tplOptions}
            isRequired
            isInvalid={!tplKey}
            errorMessage="Selecciona una plantilla aprobada."
          />
        </div>
        {onSwitchText && (
          <Button size="sm" variant="outline" type="button" onPress={onSwitchText}>
            Texto libre
          </Button>
        )}
      </div>
      {tplVars.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {tplVars.map((v, i) => (
            <TextInput
              key={i}
              label={`Variable {{${i + 1}}}`}
              value={v}
              isRequired
              isInvalid={!v.trim()}
              errorMessage={`La variable {{${i + 1}}} es obligatoria.`}
              onValueChange={(val) =>
                setTplVars((arr) => {
                  const n = [...arr];
                  n[i] = val;
                  return n;
                })
              }
            />
          ))}
        </div>
      )}
      {tplCards.length > 0 && (
        <div className="space-y-2 rounded-lg border border-default-200 bg-content2 p-3">
          <p className="font-medium text-sm">Tarjetas del carousel ({tplCards.length})</p>
          <div className="space-y-3">
            {tplCards.map((card, i) => (
              <CarouselCardEditor
                key={i}
                card={card}
                phoneId={phoneId}
                onChange={(next) =>
                  setTplCards((arr) => {
                    const n = [...arr];
                    n[i] = next;
                    return n;
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
      {hasLto && (
        <div className="space-y-1 rounded-lg border border-warning-200 bg-warning-50 p-3">
          <p className="font-medium text-sm">Oferta limitada (countdown)</p>
          <p className="text-default-600 text-xs">
            Fecha y hora de expiración. WhatsApp muestra el contador en vivo al paciente.
          </p>
          <AppDateTimePicker
            label="Expiración"
            value={tplLtoExpiration}
            onChange={setTplLtoExpiration}
          />
          {ltoInvalid ? (
            <p className="flex items-center gap-1 text-danger text-xs">
              <AlertTriangle size={12} aria-hidden />
              Selecciona fecha y hora de expiración antes de enviar.
            </p>
          ) : null}
        </div>
      )}
      {copyCodeButtonIndex !== null && (
        <div className="space-y-1 rounded-lg border border-accent-200 bg-accent-50 p-3">
          <p className="font-medium text-sm">Botón Copiar código</p>
          <p className="text-default-600 text-xs">
            Valor que el paciente copia con un tap (max 15 chars).
          </p>
          <TextInput
            label="Código"
            value={tplCopyCode?.value ?? ""}
            isRequired
            isInvalid={copyCodeInvalid}
            errorMessage="El código que se copia es obligatorio."
            onValueChange={(v) =>
              setTplCopyCode({ index: copyCodeButtonIndex, value: v.slice(0, 15) })
            }
            placeholder="CLINICA20"
          />
        </div>
      )}
      {missingCardImages.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-danger-900 text-xs"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <p>Faltan imágenes en las tarjetas: {missingCardImages.map((i) => i + 1).join(", ")}</p>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit" isPending={isPending} isDisabled={!isValid}>
          <Send size={14} />
          Enviar plantilla
        </Button>
      </div>
    </Form>
  );
}

function CarouselCardEditor({
  card,
  phoneId,
  onChange,
}: {
  card: CarouselCardState;
  phoneId: string;
  onChange: (next: CarouselCardState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (!phoneId) {
      toast.error("Selecciona un número primero");
      return;
    }
    setUploading(true);
    try {
      const r = await uploadWaMedia(file, Number(phoneId));
      onChange({ ...card, imageMediaId: r.id, imageFilename: r.filename });
      toast.success(`Imagen lista (${r.filename})`);
    } catch (e) {
      toast.error(`Upload falló: ${String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border border-default-200 bg-content1 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-medium text-sm">Tarjeta {card.cardIndex + 1}</p>
        <input
          ref={fileRef}
          type="file"
          aria-label="Subir imagen de tarjeta"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          isPending={uploading}
          onPress={() => fileRef.current?.click()}
        >
          <Images size={12} />
          {card.imageMediaId ? "Cambiar imagen" : "Subir imagen"}
        </Button>
      </div>
      {card.imageMediaId && (
        <p className="mb-2 truncate font-mono text-default-500 text-xs">
          {card.imageFilename ?? "imagen"} · id:{card.imageMediaId.slice(0, 12)}…
        </p>
      )}
      {card.bodyParams.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {card.bodyParams.map((v, i) => (
            <TextInput
              key={i}
              label={`Var {{${i + 1}}}`}
              value={v}
              onValueChange={(val) => {
                const next = [...card.bodyParams];
                next[i] = val;
                onChange({ ...card, bodyParams: next });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
