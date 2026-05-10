import { Button } from "@heroui/react";
import { Images, Send } from "lucide-react";
import { useRef, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { uploadWaMedia } from "../hooks/useWaCloud";

export type CarouselCardState = {
  cardIndex: number;
  imageMediaId: string | null;
  imageFilename: string | null;
  bodyParams: string[];
};

export function TemplateComposer({
  tplKey,
  setTplKey,
  tplOptions,
  tplVars,
  setTplVars,
  tplCards,
  setTplCards,
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
  phoneId: string;
  isPending: boolean;
  onSend: () => void;
  onSwitchText?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SelectInput
            label="Plantilla aprobada"
            value={tplKey}
            onValueChange={setTplKey}
            options={tplOptions}
          />
        </div>
        {onSwitchText && (
          <Button size="sm" variant="outline" onPress={onSwitchText}>
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
      <div className="flex justify-end">
        <Button onPress={onSend} isPending={isPending} isDisabled={!tplKey}>
          <Send size={14} />
          Enviar plantilla
        </Button>
      </div>
    </div>
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
        <p className="mb-2 truncate font-mono text-default-500 text-[10px]">
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
