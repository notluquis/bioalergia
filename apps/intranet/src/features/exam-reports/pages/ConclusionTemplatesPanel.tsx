import {
  Button,
  Form,
  Label,
  ListBox,
  Select,
  Spinner,
  Surface,
  Switch,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { useConfirmDialog } from "@/context/ConfirmDialogContext";
import { useToast } from "@/context/ToastContext";
import { EXAM_TYPE_LABEL, EXAM_TYPE_ORDER } from "@/features/exam-reports/lib/exam-types";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";
import type { ExamType } from "@finanzas/orpc-contracts/exam-reports";

/**
 * Plantillas de conclusión panel — extracted from the old
 * `/settings/conclusion-templates` route so it can be hosted as a
 * `<Tabs.Panel>` inside the unified `/exam-reports` page (Phase 3 IA
 * consolidation). The route file is now a thin redirect shell.
 */
export function ConclusionTemplatesPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const confirmDialog = useConfirmDialog();

  const listQ = useQuery(examReportsKeys.templates(undefined));
  const [draftText, setDraftText] = useState("");
  const [draftExamType, setDraftExamType] = useState<ExamType | "">("");
  const [draftIsDefault, setDraftIsDefault] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      examReportsORPCClient.createTemplate({
        text: draftText.trim(),
        examType: draftExamType ? (draftExamType as ExamType) : null,
        isDefault: draftIsDefault,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "templates"] });
      setDraftText("");
      setDraftExamType("");
      setDraftIsDefault(false);
      toast.success("Plantilla creada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: (vars: { id: number; text?: string; isDefault?: boolean; isActive?: boolean }) =>
      examReportsORPCClient.updateTemplate(vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "templates"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => examReportsORPCClient.deleteTemplate({ id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "templates"] });
      toast.success("Plantilla eliminada");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const templates = listQ.data?.templates ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header>
        <h2 className="font-semibold text-foreground text-xl">Plantillas de conclusión</h2>
        <p className="text-default-600 text-sm">
          Frases predeterminadas que aparecen en el desplegable "Plantilla rápida" del wizard.
        </p>
      </header>

      <Surface variant="default" className="rounded-3xl border border-default-100 p-4">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftText.trim()) return;
            create.mutate();
          }}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_220px_140px_auto]">
            <TextField className="w-full" name="text" onChange={setDraftText} value={draftText}>
              <Label>Nueva plantilla</Label>
              <TextArea placeholder="Piel reactiva valida el examen" rows={2} />
            </TextField>
            <div className="space-y-1">
              <Label>Tipo de examen</Label>
              <Select
                aria-label="Tipo"
                onSelectionChange={(k) => setDraftExamType((k as ExamType) ?? "")}
                selectedKey={draftExamType || null}
              >
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="">Cualquiera</ListBox.Item>
                    {EXAM_TYPE_ORDER.map((t) => (
                      <ListBox.Item id={t} key={t}>
                        {EXAM_TYPE_LABEL[t]}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Predeterminada</Label>
              <Switch isSelected={draftIsDefault} onChange={setDraftIsDefault}>
                Sí
              </Switch>
            </div>
            <div className="flex items-end">
              <Button
                isDisabled={!draftText.trim() || create.isPending}
                isPending={create.isPending}
                type="submit"
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </div>
          </div>
        </Form>
      </Surface>

      <Surface variant="default" className="rounded-3xl border border-default-100 p-2">
        {listQ.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-default-600">
            <Spinner size="sm" /> Cargando…
          </div>
        ) : templates.length === 0 ? (
          <p className="p-6 text-center text-default-600">Sin plantillas aún.</p>
        ) : (
          <ul className="divide-y divide-default-100">
            {templates.map((t) => (
              <li className="flex items-center gap-3 p-3" key={t.id}>
                <div className="min-w-0 flex-1">
                  <p className="truncate">{t.text}</p>
                  <p className="text-default-600 text-xs">
                    {t.examType ? EXAM_TYPE_LABEL[t.examType] : "Cualquier tipo"}
                    {t.isDefault ? " · Predeterminada" : ""}
                  </p>
                </div>
                <Switch
                  isSelected={t.isDefault}
                  onChange={(v) => update.mutate({ id: t.id, isDefault: v })}
                >
                  Predet.
                </Switch>
                <Button
                  aria-label="Eliminar"
                  isIconOnly
                  onPress={async () => {
                    const ok = await confirmDialog({
                      title: "Eliminar plantilla",
                      description:
                        "¿Eliminar esta plantilla de conclusión? Los informes ya creados conservan su texto.",
                      confirmLabel: "Eliminar",
                      confirmVariant: "danger",
                      status: "danger",
                    });
                    if (ok) remove.mutate(t.id);
                  }}
                  size="sm"
                  variant="danger"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Surface>
    </div>
  );
}
