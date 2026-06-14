import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type { BodyBlock } from "@finanzas/orpc-contracts/site-content";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  createArticle,
  deleteArticle,
  getArticle,
  siteContentKeys,
  updateArticle,
} from "@/features/site-content/api";
import type { ContentStatus } from "@/features/site-content/api";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { chileDay } from "@/lib/dates";
import { toast } from "@/lib/toast-interceptor";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CATEGORIES = ["Educación", "Diagnóstico", "Tratamiento", "Prevención"] as const;

const STATUS_OPTIONS: { id: ContentStatus; label: string }[] = [
  { id: "DRAFT", label: "Borrador" },
  { id: "PUBLISHED", label: "Publicada" },
  { id: "ARCHIVED", label: "Archivada" },
];

type Draft = {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  reading_minutes: number;
  status: ContentStatus;
  seo_title: string;
  seo_description: string;
  published_at: string;
  bodyJson: string;
};

function emptyDraft(): Draft {
  return {
    slug: "",
    title: "",
    category: CATEGORIES[0],
    excerpt: "",
    reading_minutes: 4,
    status: "DRAFT",
    seo_title: "",
    seo_description: "",
    published_at: "",
    bodyJson: "[]",
  };
}

type ArticleFormModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  articleId?: number;
};

export function ArticleFormModal({ isOpen, onOpenChange, articleId }: ArticleFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = articleId !== undefined;

  const articleQuery = useQuery({
    queryKey: articleId !== undefined ? siteContentKeys.article(articleId) : ["article", "new"],
    queryFn: () => getArticle(articleId as number),
    enabled: isOpen && articleId !== undefined,
  });

  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);

  // Re-hidratar al cambiar el artículo objetivo o reabrir en limpio.
  const targetKey = isOpen ? `${articleId ?? "new"}:${articleQuery.dataUpdatedAt}` : null;
  if (isOpen && targetKey !== null && loadedKey !== targetKey) {
    if (!isEditing) {
      setDraft(emptyDraft());
      setBodyError(null);
      setLoadedKey(targetKey);
    } else if (articleQuery.data) {
      const a = articleQuery.data;
      setDraft({
        slug: a.slug,
        title: a.title,
        category: a.category,
        excerpt: a.excerpt,
        reading_minutes: a.reading_minutes,
        status: a.status,
        seo_title: a.seo_title ?? "",
        seo_description: a.seo_description ?? "",
        published_at: a.published_at ? chileDay(a.published_at) : "",
        bodyJson: JSON.stringify(a.body, null, 2),
      });
      setBodyError(null);
      setLoadedKey(targetKey);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: siteContentKeys.articles() });

  const slugValid = SLUG_RE.test(draft.slug);

  const saveMutation = useMutation({
    mutationFn: () => {
      let body: BodyBlock[];
      try {
        const parsed: unknown = JSON.parse(draft.bodyJson);
        if (!Array.isArray(parsed)) throw new Error("El cuerpo debe ser un arreglo de bloques.");
        body = parsed as BodyBlock[];
      } catch (e) {
        const msg = e instanceof Error ? e.message : "JSON inválido";
        setBodyError(msg);
        throw new Error(`Cuerpo inválido: ${msg}`);
      }
      setBodyError(null);

      const publishedAt = draft.published_at.trim() ? new Date(draft.published_at) : null;

      const payload = {
        slug: draft.slug.trim(),
        title: draft.title.trim(),
        category: draft.category.trim(),
        excerpt: draft.excerpt.trim(),
        reading_minutes: draft.reading_minutes,
        body,
        status: draft.status,
        seo_title: draft.seo_title.trim() || null,
        seo_description: draft.seo_description.trim() || null,
        published_at: publishedAt,
      };

      return isEditing ? updateArticle({ id: articleId, ...payload }) : createArticle(payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Noticia actualizada" : "Noticia creada");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!isEditing) throw new Error("Sin noticia");
      return deleteArticle(articleId);
    },
    onSuccess: () => {
      toast.success("Noticia eliminada");
      void invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const canSave =
    slugValid &&
    draft.title.trim().length > 0 &&
    draft.category.trim().length > 0 &&
    draft.excerpt.trim().length > 0;

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-label={isEditing ? "Editar noticia" : "Nueva noticia"}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{isEditing ? "Editar noticia" : "Nueva noticia"}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {isEditing && articleQuery.isLoading ? (
              <p className="p-4 text-default-500 text-sm">Cargando noticia…</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  value={draft.slug}
                  onChange={(v) => set("slug", v)}
                  isRequired
                  isInvalid={draft.slug.length > 0 && !slugValid}
                >
                  <Label>Slug</Label>
                  <Input placeholder="alergia-en-primavera" />
                  <p className="text-default-500 text-xs">
                    kebab-case: minúsculas, números y guiones (ej. <code>mi-articulo</code>).
                  </p>
                </TextField>

                <TextField value={draft.title} onChange={(v) => set("title", v)} isRequired>
                  <Label>Título</Label>
                  <Input placeholder="Cómo manejar la alergia en primavera" />
                </TextField>

                <div className="space-y-1">
                  <Label>Categoría</Label>
                  <Select
                    aria-label="Categoría"
                    selectedKey={draft.category}
                    onSelectionChange={(k) => set("category", String(k))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {CATEGORIES.map((c) => (
                          <ListBox.Item id={c} key={c}>
                            {c}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select
                    aria-label="Estado"
                    selectedKey={draft.status}
                    onSelectionChange={(k) => set("status", k as ContentStatus)}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {STATUS_OPTIONS.map((s) => (
                          <ListBox.Item id={s.id} key={s.id}>
                            {s.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <NumberField
                  variant="secondary"
                  minValue={1}
                  value={draft.reading_minutes}
                  onChange={(v) => set("reading_minutes", v ?? 1)}
                >
                  <Label>Minutos de lectura</Label>
                  <NumberField.Group className="grid-cols-1">
                    <NumberField.Input />
                  </NumberField.Group>
                </NumberField>

                <TextField value={draft.published_at} onChange={(v) => set("published_at", v)}>
                  <Label>Fecha de publicación</Label>
                  <Input type="date" />
                  <p className="text-default-500 text-xs">Vacío = sin publicar.</p>
                </TextField>

                <TextField
                  className="sm:col-span-2"
                  value={draft.excerpt}
                  onChange={(v) => set("excerpt", v)}
                  isRequired
                >
                  <Label>Extracto</Label>
                  <TextArea placeholder="Resumen breve que aparece en el listado." rows={2} />
                </TextField>

                <TextField
                  className="sm:col-span-2"
                  value={draft.seo_title}
                  onChange={(v) => set("seo_title", v)}
                >
                  <Label>SEO — título</Label>
                  <Input placeholder="Opcional" />
                </TextField>

                <TextField
                  className="sm:col-span-2"
                  value={draft.seo_description}
                  onChange={(v) => set("seo_description", v)}
                >
                  <Label>SEO — descripción</Label>
                  <TextArea placeholder="Opcional" rows={2} />
                </TextField>

                <TextField
                  className="sm:col-span-2"
                  value={draft.bodyJson}
                  onChange={(v) => {
                    set("bodyJson", v);
                    if (bodyError) setBodyError(null);
                  }}
                  isInvalid={bodyError !== null}
                >
                  <Label>Cuerpo (JSON de bloques)</Label>
                  <TextArea
                    className="font-mono text-xs"
                    rows={10}
                    placeholder={
                      '[\n  { "type": "h2", "text": "Subtítulo" },\n  { "type": "p", "text": "Párrafo…" },\n  { "type": "ul", "items": ["Punto 1", "Punto 2"] }\n]'
                    }
                  />
                  <p className="text-default-500 text-xs">
                    Bloques: <code>{'{"type":"p","text":…}'}</code>,{" "}
                    <code>{'{"type":"h2","text":…}'}</code>,{" "}
                    <code>{'{"type":"ul","items":[…]}'}</code>.
                  </p>
                  {bodyError ? <p className="text-danger text-xs">{bodyError}</p> : null}
                </TextField>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {isEditing ? (
              <Button
                variant="outline"
                className="mr-auto gap-2 text-danger"
                onPress={async () => {
                  const ok = await confirmAction({
                    title: "Eliminar noticia",
                    description: `¿Eliminar "${draft.title || "esta noticia"}"? Esta acción no se puede deshacer.`,
                    variant: "danger",
                  });
                  if (ok) deleteMutation.mutate();
                }}
              >
                <Trash2 size={18} /> Eliminar
              </Button>
            ) : null}
            <Button slot="close" variant="secondary">
              Cancelar
            </Button>
            <Button
              isPending={saveMutation.isPending}
              isDisabled={!canSave}
              onPress={() => saveMutation.mutate()}
            >
              {isEditing ? "Guardar" : "Crear noticia"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
