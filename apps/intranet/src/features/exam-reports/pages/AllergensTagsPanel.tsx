import {
  Alert,
  Button,
  Chip,
  Label,
  SearchField,
  Skeleton,
  Surface,
  Switch,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Tag as TagIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { examReportsORPCClient } from "@/features/exam-reports/orpc";
import { examReportsKeys } from "@/features/exam-reports/queries";
import { ALLERGEN_TAG_SUGGESTIONS } from "@finanzas/orpc-contracts/exam-reports";

const PAGE_LIMIT = 50;

const TAG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

interface AllergenRow {
  id: string;
  commonName: string;
  scientificName: string | null;
  category: string;
  tags: string[];
  isActive: boolean;
}

/**
 * Normalises a free-form draft string ("PR-10, profilin, , tropomyosin")
 * into a clean tag[]: trim, lowercase, dedupe, drop blanks.
 *
 * Kept module-level (not inside the component) so the test file can
 * import + unit-test it without rendering the panel.
 */
export function parseTagsDraft(draft: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of draft.split(/[,\n]/u)) {
    const t = raw.trim().toLowerCase();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function findInvalidTags(tags: string[]): string[] {
  return tags.filter((t) => !TAG_PATTERN.test(t));
}

/**
 * Admin panel for ClinicalAllergen.tags. Lives inside the unified
 * `/exam-reports?tab=allergens` page (Phase 3 IA). The 2026-05-18
 * SQL migration backfilled ~120 rows with EAACI cross-reactivity
 * family tags (pr-10, profilin, tropomyosin, ltp, serum-albumin,
 * parvalbumin, lipocalin); this panel lets clinicians refine those
 * tags without writing additional migrations.
 *
 * UX:
 *  - top: search field + "solo etiquetados" toggle
 *  - table: scientific/common name, category, comma-separated
 *    tag editor (TextArea) + per-row Save button
 *  - canonical suggestions render as one-click insert Chips
 *  - server invalidates the cache on success, optimistic toast
 */
export function AllergensTagsPanel() {
  const toast = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [onlyTagged, setOnlyTagged] = useState(false);
  const [page, setPage] = useState(0);

  // Reset to page 0 whenever filters change so the user doesn't land
  // on an empty offset after narrowing the result set.
  useEffect(() => {
    setPage(0);
  }, [search, onlyTagged]);

  const listQ = useQuery(
    examReportsKeys.allergensWithTags({
      search: search.trim() || undefined,
      onlyTagged: onlyTagged || undefined,
      limit: PAGE_LIMIT,
      offset: page * PAGE_LIMIT,
    })
  );

  // Draft state keyed by allergen id. Each entry is the raw text in
  // the row's TextArea — we parse on submit so the user can paste a
  // comma-list without us "auto-cleaning" while they type.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Hydrate drafts from server response so the TextArea reflects the
  // current persisted tags. Only sets keys that don't already have a
  // local edit, to avoid trampling unsaved work on refetch.
  useEffect(() => {
    const items = listQ.data?.items;
    if (!items) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (next[item.id] === undefined) {
          next[item.id] = item.tags.join(", ");
        }
      }
      return next;
    });
  }, [listQ.data]);

  const updateMut = useMutation({
    mutationFn: (vars: { id: string; tags: string[] }) =>
      examReportsORPCClient.updateAllergenTags(vars),
    onSuccess: (updated) => {
      // Patch the local draft so any whitespace the user typed gets
      // canonicalised after save.
      setDrafts((prev) => ({ ...prev, [updated.id]: updated.tags.join(", ") }));
      void qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "allergens-admin"] });
      // Also bust the wizard-side `listAllergens` cache so the PDF
      // generator picks up the new tags without a hard refresh.
      void qc.invalidateQueries({ queryKey: [...examReportsKeys.all, "allergens"] });
      toast.success("Etiquetas guardadas");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const handleSave = useCallback(
    (id: string) => {
      const draft = drafts[id] ?? "";
      const tags = parseTagsDraft(draft);
      const invalid = findInvalidTags(tags);
      if (invalid.length > 0) {
        toast.error(`Etiquetas inválidas: ${invalid.join(", ")}`);
        return;
      }
      updateMut.mutate({ id, tags });
    },
    [drafts, toast, updateMut]
  );

  const handleSuggestion = useCallback((id: string, tag: string) => {
    setDrafts((prev) => {
      const current = parseTagsDraft(prev[id] ?? "");
      if (current.includes(tag)) return prev;
      const next = [...current, tag];
      return { ...prev, [id]: next.join(", ") };
    });
  }, []);

  const total = listQ.data?.total ?? 0;
  const items = listQ.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const tableAriaProps = useMemo(
    () =>
      listQ.isPending
        ? ({ "aria-busy": true, "aria-label": "Cargando alérgenos" } as const)
        : ({ "aria-label": "Alérgenos y etiquetas" } as const),
    [listQ.isPending]
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-foreground text-xl">Etiquetas de alérgenos</h2>
        <p className="text-default-600 text-sm">
          Familias de reactividad cruzada EAACI usadas por el generador de informes para activar
          automáticamente el descargo correspondiente.
        </p>
      </header>

      <Surface
        variant="default"
        className="flex flex-col gap-3 rounded-3xl border border-default-100 p-4 md:flex-row md:items-end"
      >
        <SearchField
          aria-label="Buscar alérgenos"
          className="flex-1"
          onChange={setSearch}
          value={search}
        >
          <Label>Buscar</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Nombre común, científico o categoría" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>

        <div className="flex flex-col gap-1">
          <Label>Filtro</Label>
          <Switch isSelected={onlyTagged} onChange={setOnlyTagged}>
            Solo etiquetados
          </Switch>
        </div>
      </Surface>

      <Surface variant="default" className="overflow-hidden rounded-3xl border border-default-100">
        {listQ.isPending ? (
          <div aria-busy="true" aria-label="Cargando alérgenos" className="space-y-2 p-4">
            <Skeleton aria-hidden="true" className="h-6 w-1/3 rounded-md" />
            <Skeleton aria-hidden="true" className="h-24 w-full rounded-xl" />
            <Skeleton aria-hidden="true" className="h-24 w-full rounded-xl" />
            <Skeleton aria-hidden="true" className="h-24 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <Alert status="default">
            <Alert.Content>
              <Alert.Description>Sin alérgenos para los filtros seleccionados.</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <Table variant="secondary">
            <Table.Content {...tableAriaProps}>
              <Table.Header>
                <Table.Column isRowHeader>Alérgeno</Table.Column>
                <Table.Column className="hidden md:table-cell">Categoría</Table.Column>
                <Table.Column>Etiquetas</Table.Column>
                <Table.Column>Acciones</Table.Column>
              </Table.Header>
              <Table.Body>
                {items.map((row: AllergenRow) => {
                  const draft = drafts[row.id] ?? row.tags.join(", ");
                  const parsedDraft = parseTagsDraft(draft);
                  const original = row.tags.slice().sort().join("|");
                  const next = parsedDraft.slice().sort().join("|");
                  const dirty = original !== next;
                  const invalid = findInvalidTags(parsedDraft);
                  return (
                    <Table.Row id={row.id} key={row.id}>
                      <Table.Cell>
                        <div className="font-medium text-default-900 text-sm">{row.commonName}</div>
                        {row.scientificName ? (
                          <div className="text-default-500 text-xs italic">
                            {row.scientificName}
                          </div>
                        ) : null}
                        {!row.isActive ? (
                          <Chip color="warning" size="sm" variant="soft">
                            Inactivo
                          </Chip>
                        ) : null}
                      </Table.Cell>
                      <Table.Cell className="hidden md:table-cell text-default-600 text-xs">
                        {row.category}
                      </Table.Cell>
                      <Table.Cell>
                        <div className="space-y-2">
                          <TextField
                            className="w-full"
                            name={`tags-${row.id}`}
                            onChange={(v) => setDrafts((prev) => ({ ...prev, [row.id]: v }))}
                            value={draft}
                          >
                            <Label className="sr-only">Etiquetas para {row.commonName}</Label>
                            <TextArea placeholder="pr-10, profilin" rows={2} />
                          </TextField>
                          <div className="flex flex-wrap gap-1">
                            {ALLERGEN_TAG_SUGGESTIONS.map((tag) => (
                              <Button
                                aria-label={`Agregar etiqueta ${tag}`}
                                key={tag}
                                onPress={() => handleSuggestion(row.id, tag)}
                                size="sm"
                                variant="ghost"
                              >
                                <TagIcon className="size-3" /> {tag}
                              </Button>
                            ))}
                          </div>
                          {invalid.length > 0 ? (
                            <p className="text-danger-500 text-xs">
                              Inválidas (kebab-case minúscula): {invalid.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          isDisabled={!dirty || invalid.length > 0 || updateMut.isPending}
                          isPending={updateMut.isPending && updateMut.variables?.id === row.id}
                          onPress={() => handleSave(row.id)}
                          size="sm"
                          variant="primary"
                        >
                          <Save className="size-4" /> Guardar
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table>
        )}
      </Surface>

      {total > 0 ? (
        <div className="flex items-center justify-between text-default-600 text-sm">
          <span>
            Mostrando {items.length} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              isDisabled={page === 0 || listQ.isPending}
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              size="sm"
              variant="ghost"
            >
              Anterior
            </Button>
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <Button
              isDisabled={page + 1 >= totalPages || listQ.isPending}
              onPress={() => setPage((p) => p + 1)}
              size="sm"
              variant="ghost"
            >
              Siguiente
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
