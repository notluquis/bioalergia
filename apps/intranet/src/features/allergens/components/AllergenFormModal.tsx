import { Button, Input, Label, Modal, Switch, TextField } from "@heroui/react";
import type { ClinicalAllergenDto } from "@finanzas/orpc-contracts/clinical-allergens";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  allergensKeys,
  createAllergen,
  deactivateAllergen,
  updateAllergen,
} from "@/features/allergens/api";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast-interceptor";

type AliasDraft = { alias: string; aliasType: string };

type Draft = {
  commonName: string;
  scientificName: string;
  englishName: string;
  category: string;
  categoryEn: string;
  pollenType: string;
  pollenTypeEn: string;
  tags: string;
  isActive: boolean;
  aliases: AliasDraft[];
};

function draftFrom(a?: ClinicalAllergenDto): Draft {
  return {
    commonName: a?.commonName ?? "",
    scientificName: a?.scientificName ?? "",
    englishName: a?.englishName ?? "",
    category: a?.category ?? "",
    categoryEn: a?.categoryEn ?? "",
    pollenType: a?.pollenType ?? "",
    pollenTypeEn: a?.pollenTypeEn ?? "",
    tags: (a?.tags ?? []).join(", "),
    isActive: a?.isActive ?? true,
    aliases: (a?.aliases ?? []).map((al) => ({ alias: al.alias, aliasType: al.aliasType })),
  };
}

type AllergenFormModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  allergen?: ClinicalAllergenDto;
};

export function AllergenFormModal({ isOpen, onOpenChange, allergen }: AllergenFormModalProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(allergen));
  const [loadedFor, setLoadedFor] = useState<string | null>(allergen?.id ?? null);

  // Re-hidratar al cambiar el alérgeno objetivo o reabrir en limpio.
  const targetId = allergen?.id ?? null;
  if (isOpen && loadedFor !== targetId) {
    setDraft(draftFrom(allergen));
    setLoadedFor(targetId);
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setAlias = (index: number, key: keyof AliasDraft, value: string) =>
    setDraft((d) => ({
      ...d,
      aliases: d.aliases.map((al, i) => (i === index ? { ...al, [key]: value } : al)),
    }));

  const addAlias = () =>
    setDraft((d) => ({ ...d, aliases: [...d.aliases, { alias: "", aliasType: "MANUAL" }] }));

  const removeAlias = (index: number) =>
    setDraft((d) => ({ ...d, aliases: d.aliases.filter((_, i) => i !== index) }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: allergensKeys.all });

  const saveMutation = useMutation({
    mutationFn: () => {
      const tags = draft.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const aliases = draft.aliases
        .map((al) => ({ alias: al.alias.trim(), aliasType: al.aliasType.trim() || "MANUAL" }))
        .filter((al) => al.alias.length > 0);
      const payload = {
        commonName: draft.commonName.trim(),
        scientificName: draft.scientificName.trim() || null,
        englishName: draft.englishName.trim() || null,
        category: draft.category.trim(),
        categoryEn: draft.categoryEn.trim() || null,
        pollenType: draft.pollenType.trim() || null,
        pollenTypeEn: draft.pollenTypeEn.trim() || null,
        tags,
        isActive: draft.isActive,
        aliases,
      };
      return allergen ? updateAllergen({ id: allergen.id, ...payload }) : createAllergen(payload);
    },
    onSuccess: () => {
      toast.success(allergen ? "Alérgeno actualizado" : "Alérgeno creado");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deactivateMutation = useMutation({
    mutationFn: () => {
      if (!allergen) throw new Error("Sin alérgeno");
      return deactivateAllergen(allergen.id);
    },
    onSuccess: () => {
      toast.success("Alérgeno desactivado");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo desactivar"),
  });

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={allergen ? "Editar alérgeno" : "Nuevo alérgeno"}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{allergen ? "Editar alérgeno" : "Nuevo alérgeno"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                className="sm:col-span-2"
                value={draft.commonName}
                onChange={(v) => set("commonName", v)}
                isRequired
              >
                <Label>Nombre común</Label>
                <Input placeholder="Pasto bermuda" />
              </TextField>
              <TextField value={draft.scientificName} onChange={(v) => set("scientificName", v)}>
                <Label>Nombre científico</Label>
                <Input placeholder="Cynodon dactylon" />
              </TextField>
              <TextField value={draft.englishName} onChange={(v) => set("englishName", v)}>
                <Label>Nombre en inglés</Label>
                <Input placeholder="Bermuda grass" />
              </TextField>
              <TextField value={draft.category} onChange={(v) => set("category", v)} isRequired>
                <Label>Categoría</Label>
                <Input placeholder="Gramínea" />
              </TextField>
              <TextField value={draft.categoryEn} onChange={(v) => set("categoryEn", v)}>
                <Label>Categoría (inglés)</Label>
                <Input placeholder="Grass" />
              </TextField>
              <TextField value={draft.pollenType} onChange={(v) => set("pollenType", v)}>
                <Label>Tipo de polen</Label>
                <Input placeholder="Polen de pastos" />
              </TextField>
              <TextField value={draft.pollenTypeEn} onChange={(v) => set("pollenTypeEn", v)}>
                <Label>Tipo de polen (inglés)</Label>
                <Input placeholder="Grass pollen" />
              </TextField>
              <TextField
                className="sm:col-span-2"
                value={draft.tags}
                onChange={(v) => set("tags", v)}
              >
                <Label>Etiquetas</Label>
                <Input placeholder="estacional, exterior (separadas por coma)" />
              </TextField>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Alias</Label>
                  <Button size="sm" variant="secondary" className="gap-1" onPress={addAlias}>
                    <Plus size={16} /> Agregar alias
                  </Button>
                </div>
                {draft.aliases.length === 0 ? (
                  <p className="text-default-500 text-sm">Sin alias.</p>
                ) : (
                  <div className="space-y-2">
                    {draft.aliases.map((al, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <TextField
                          className="flex-1"
                          value={al.alias}
                          onChange={(v) => setAlias(index, "alias", v)}
                          aria-label={`Alias ${index + 1}`}
                        >
                          <Input placeholder="Sinónimo" />
                        </TextField>
                        <TextField
                          className="w-40"
                          value={al.aliasType}
                          onChange={(v) => setAlias(index, "aliasType", v)}
                          aria-label={`Tipo de alias ${index + 1}`}
                        >
                          <Input placeholder="MANUAL" />
                        </TextField>
                        <Button
                          isIconOnly
                          variant="outline"
                          className="text-danger"
                          aria-label={`Quitar alias ${index + 1}`}
                          onPress={() => removeAlias(index)}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 sm:col-span-2">
                <Switch isSelected={draft.isActive} onChange={(v) => set("isActive", v)}>
                  Activo
                </Switch>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            {allergen ? (
              <Button
                variant="outline"
                className="mr-auto gap-2 text-danger"
                onPress={async () => {
                  const ok = await confirmAction({
                    title: "Desactivar alérgeno",
                    description: `¿Desactivar "${allergen.commonName}"?`,
                    variant: "danger",
                  });
                  if (ok) deactivateMutation.mutate();
                }}
              >
                <Trash2 size={18} /> Desactivar
              </Button>
            ) : null}
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              isPending={saveMutation.isPending}
              isDisabled={!draft.commonName.trim() || !draft.category.trim()}
              onPress={() => saveMutation.mutate()}
            >
              {allergen ? "Guardar" : "Crear alérgeno"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
