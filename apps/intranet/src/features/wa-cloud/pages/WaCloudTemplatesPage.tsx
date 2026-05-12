import { Button, Card, Chip, Modal, Spinner, Table } from "@heroui/react";
import { BookOpen, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  uploadTemplateHeaderSample,
  useAccounts,
  useCloneTemplateFromLibrary,
  useCreateTemplate,
  useDeleteTemplate,
  useTemplateLibrary,
  useTemplates,
} from "../hooks/useWaCloud";

const CATEGORY_OPTIONS = [
  { value: "UTILITY", label: "Utility (transaccional)" },
  { value: "MARKETING", label: "Marketing (promocional)" },
  { value: "AUTHENTICATION", label: "Authentication (OTP)" },
];

const LANG_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "es_CL", label: "Español Chile" },
  { value: "en", label: "English" },
  { value: "en_US", label: "English US" },
  { value: "pt_BR", label: "Português (Brasil)" },
];

export function WaCloudTemplatesPage() {
  const tpl = useTemplates();
  const del = useDeleteTemplate();
  const [createOpen, setCreateOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{
    id: number;
    accountId: number;
    name: string;
  } | null>(null);

  if (tpl.isLoading || !tpl.data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onPress={() => setLibraryOpen(true)}>
          <BookOpen size={14} />
          Catálogo Meta
        </Button>
        <Button onPress={() => setCreateOpen(true)}>
          <Plus size={14} />
          Nueva plantilla
        </Button>
      </div>

      <Card>
        <Card.Content className="p-0">
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Templates">
                <Table.Header>
                  <Table.Column isRowHeader>Nombre</Table.Column>
                  <Table.Column>Idioma</Table.Column>
                  <Table.Column>Categoría</Table.Column>
                  <Table.Column>Estado</Table.Column>
                  <Table.Column>Calidad</Table.Column>
                  <Table.Column>Acciones</Table.Column>
                </Table.Header>
                <Table.Body items={tpl.data.templates}>
                  {(t) => (
                    <Table.Row id={String(t.id)}>
                      <Table.Cell>{t.name}</Table.Cell>
                      <Table.Cell>{t.language}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft">
                          <Chip.Label>{t.category}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip
                          size="sm"
                          color={
                            t.status === "APPROVED"
                              ? "success"
                              : t.status === "REJECTED" || t.status === "DISABLED"
                                ? "danger"
                                : "warning"
                          }
                          variant="soft"
                        >
                          <Chip.Label>{t.status}</Chip.Label>
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>{t.qualityScore ?? "—"}</Table.Cell>
                      <Table.Cell>
                        <Button
                          size="sm"
                          variant="danger-soft"
                          isIconOnly
                          aria-label="Eliminar"
                          onPress={() =>
                            setConfirmDel({ id: t.id, accountId: t.accountId, name: t.name })
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </Card.Content>
      </Card>

      <CreateTemplateModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <LibraryModal isOpen={libraryOpen} onClose={() => setLibraryOpen(false)} />

      <Modal>
        <Modal.Backdrop
          isOpen={Boolean(confirmDel)}
          onOpenChange={(o) => !o && setConfirmDel(null)}
          isDismissable
          className="bg-black/40"
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="w-full max-w-sm rounded-2xl bg-background p-5 shadow-xl">
              <Modal.Header>
                <Modal.Heading className="font-bold">Eliminar plantilla</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm">
                  ¿Eliminar <strong>{confirmDel?.name}</strong> en Meta? No se puede deshacer.
                </p>
              </Modal.Body>
              <Modal.Footer className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onPress={() => setConfirmDel(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger-soft"
                  isPending={del.isPending}
                  onPress={async () => {
                    if (!confirmDel) return;
                    try {
                      await del.mutateAsync({
                        accountId: confirmDel.accountId,
                        name: confirmDel.name,
                      });
                      toast.success("Plantilla eliminada");
                      setConfirmDel(null);
                    } catch (err) {
                      toast.error(`Error: ${String(err)}`);
                    }
                  }}
                >
                  <Trash2 size={14} />
                  Eliminar
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}

function CreateTemplateModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const accounts = useAccounts();
  const create = useCreateTemplate();

  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es");
  const [category, setCategory] = useState<"UTILITY" | "MARKETING" | "AUTHENTICATION">("UTILITY");
  const [headerKind, setHeaderKind] = useState<"NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT">(
    "NONE"
  );
  const [headerText, setHeaderText] = useState("");
  const [headerHandle, setHeaderHandle] = useState("");
  const [headerFilename, setHeaderFilename] = useState("");
  const [headerUploading, setHeaderUploading] = useState(false);
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAccountId("");
      setName("");
      setLanguage("es");
      setCategory("UTILITY");
      setHeaderKind("NONE");
      setHeaderText("");
      setHeaderHandle("");
      setHeaderFilename("");
      setBodyText("");
      setFooterText("");
    }
  }, [isOpen]);

  // Sample header media upload — Meta requires a sample for IMAGE/VIDEO/
  // DOCUMENT headers during template approval. Operator picks a phone
  // number for the upload (resumable upload runs against any phone in
  // the account); the resulting handle goes into header.example.
  const onHeaderFile = async (file: File) => {
    const acc = accounts.data?.accounts.find((a) => String(a.id) === accountId);
    const phoneId = acc?.phoneNumbers[0]?.id;
    if (!phoneId) {
      toast.error("Selecciona la cuenta y asegúrate que tenga un número activo");
      return;
    }
    setHeaderUploading(true);
    try {
      const r = await uploadTemplateHeaderSample(file, phoneId);
      setHeaderHandle(r.handle);
      setHeaderFilename(r.filename);
      toast.success(`Sample subida (${r.filename})`);
    } catch (e) {
      toast.error(`Upload sample falló: ${String(e)}`);
    } finally {
      setHeaderUploading(false);
    }
  };

  const accountOptions = [
    { value: "", label: "Selecciona cuenta WABA" },
    ...(accounts.data?.accounts ?? []).map((a) => ({
      value: String(a.id),
      label: a.displayName ?? a.wabaId,
    })),
  ];

  const submit = async () => {
    if (!accountId) {
      toast.error("Selecciona cuenta");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
      toast.error("Nombre solo permite minúsculas, números y guion bajo");
      return;
    }
    if (!bodyText.trim()) {
      toast.error("Body es obligatorio");
      return;
    }
    const components: Array<Record<string, unknown>> = [];
    if (headerKind === "TEXT" && headerText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
    } else if (headerKind === "IMAGE" || headerKind === "VIDEO" || headerKind === "DOCUMENT") {
      if (!headerHandle) {
        toast.error(`Sube una sample de ${headerKind} antes de crear`);
        return;
      }
      components.push({
        type: "HEADER",
        format: headerKind,
        example: { header_handle: [headerHandle] },
      });
    }
    components.push({ type: "BODY", text: bodyText.trim() });
    if (footerText.trim()) {
      components.push({ type: "FOOTER", text: footerText.trim() });
    }
    try {
      await create.mutateAsync({
        accountId: Number(accountId),
        name: name.trim(),
        language,
        category,
        components,
      });
      toast.success("Plantilla enviada a Meta para revisión");
      onClose();
    } catch (err) {
      toast.error(`Error: ${String(err)}`);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Nueva plantilla
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Meta revisará la plantilla antes de aprobarla. Usa <code>{"{{1}}"}</code>,
                <code>{"{{2}}"}</code> para variables.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <SelectInput
                label="Cuenta WABA"
                value={accountId}
                onValueChange={setAccountId}
                options={accountOptions}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextInput
                  label="Nombre (snake_case)"
                  value={name}
                  onValueChange={setName}
                  placeholder="bioalergia_recordatorio"
                />
                <SelectInput
                  label="Idioma"
                  value={language}
                  onValueChange={setLanguage}
                  options={LANG_OPTIONS}
                />
              </div>
              <SelectInput
                label="Categoría"
                value={category}
                onValueChange={(v) => setCategory(v as "UTILITY" | "MARKETING" | "AUTHENTICATION")}
                options={CATEGORY_OPTIONS}
              />
              <SelectInput
                label="Tipo de encabezado"
                value={headerKind}
                onValueChange={(v) =>
                  setHeaderKind(v as "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT")
                }
                options={[
                  { value: "NONE", label: "Sin encabezado" },
                  { value: "TEXT", label: "Texto" },
                  { value: "IMAGE", label: "Imagen" },
                  { value: "VIDEO", label: "Video" },
                  { value: "DOCUMENT", label: "Documento" },
                ]}
              />
              {headerKind === "TEXT" && (
                <TextInput
                  label="Encabezado (máx 60)"
                  value={headerText}
                  onValueChange={setHeaderText}
                  placeholder="Recordatorio de cita"
                />
              )}
              {(headerKind === "IMAGE" || headerKind === "VIDEO" || headerKind === "DOCUMENT") && (
                <div className="space-y-1 rounded-lg border border-default-200 bg-content2 p-3">
                  <p className="font-medium text-sm">Sample {headerKind.toLowerCase()}</p>
                  <p className="text-default-500 text-xs">
                    Meta requiere una muestra del medio para aprobar la plantilla.
                  </p>
                  <input
                    type="file"
                    accept={
                      headerKind === "IMAGE"
                        ? "image/jpeg,image/png"
                        : headerKind === "VIDEO"
                          ? "video/mp4,video/3gpp"
                          : "application/pdf"
                    }
                    disabled={headerUploading || !accountId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onHeaderFile(f);
                    }}
                    className="block w-full text-xs"
                  />
                  {headerHandle && (
                    <p className="font-mono text-xs text-default-500">
                      handle subido: {headerFilename}
                    </p>
                  )}
                </div>
              )}
              <TextAreaInput
                label="Body (obligatorio, máx 1024)"
                value={bodyText}
                onValueChange={setBodyText}
                placeholder="Hola {{1}}, te recordamos tu cita el {{2}} a las {{3}}."
                rows={4}
              />
              <TextInput
                label="Pie (opcional, máx 60)"
                value={footerText}
                onValueChange={setFooterText}
                placeholder="Bioalergia · Centro Médico"
              />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={create.isPending}>
                <Plus size={14} />
                Crear y enviar a revisión
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LibraryModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!accountId && accounts.data?.accounts[0]) {
      setAccountId(String(accounts.data.accounts[0].id));
    }
  }, [accounts.data, accountId]);

  const numericAccountId = accountId ? Number.parseInt(accountId, 10) : undefined;
  const lib = useTemplateLibrary(
    numericAccountId
      ? {
          accountId: numericAccountId,
          search: search.trim() || undefined,
          language: language || undefined,
          category: category || undefined,
        }
      : undefined
  );
  const clone = useCloneTemplateFromLibrary();

  const accountOptions = (accounts.data?.accounts ?? []).map((a) => ({
    value: String(a.id),
    label: a.displayName ?? a.wabaId,
  }));

  const handleClone = (template: { name: string; language: string; category: string }) => {
    if (!numericAccountId) return;
    const validCategory = ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(
      template.category.toUpperCase()
    )
      ? (template.category.toUpperCase() as "MARKETING" | "UTILITY" | "AUTHENTICATION")
      : "UTILITY";
    clone.mutate(
      {
        accountId: numericAccountId,
        libraryTemplateName: template.name,
        language: template.language,
        category: validCategory,
      },
      {
        onSuccess: () => {
          toast.success(`Clonada "${template.name}". Aprobada al instante por Meta.`);
        },
        onError: (e) => toast.error(`Clone falló: ${String(e)}`),
      }
    );
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-3xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                <BookOpen size={20} className="mr-2 inline" />
                Catálogo Meta de plantillas
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Plantillas pre-aprobadas por Meta. Clonarlas evita el delay de approval.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                <SelectInput
                  label="Cuenta"
                  value={accountId}
                  onValueChange={setAccountId}
                  options={accountOptions}
                />
                <SelectInput
                  label="Categoría"
                  value={category}
                  onValueChange={setCategory}
                  options={[{ value: "", label: "Todas" }, ...CATEGORY_OPTIONS]}
                />
                <SelectInput
                  label="Idioma"
                  value={language}
                  onValueChange={setLanguage}
                  options={[{ value: "", label: "Todos" }, ...LANG_OPTIONS]}
                />
                <TextInput
                  label="Buscar"
                  value={search}
                  onValueChange={setSearch}
                  placeholder="appointment…"
                />
              </div>
              {lib.isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (lib.data?.templates ?? []).length === 0 ? (
                <p className="py-12 text-center text-default-500 text-sm">
                  Sin resultados. Cambia los filtros o quita la búsqueda.
                </p>
              ) : (
                <div className="space-y-2">
                  {(lib.data?.templates ?? []).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-start gap-3 rounded-lg border border-default-200 bg-content1 p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-sm">{t.name}</p>
                          <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>{t.language}</Chip.Label>
                          </Chip>
                          <Chip size="sm" variant="soft" color="accent">
                            <Chip.Label>{t.category}</Chip.Label>
                          </Chip>
                          {t.topic && (
                            <Chip size="sm" variant="soft" color="default">
                              <Chip.Label>{t.topic}</Chip.Label>
                            </Chip>
                          )}
                        </div>
                        {t.body && (
                          <p className="line-clamp-2 text-default-600 text-xs whitespace-pre-wrap">
                            {t.body}
                          </p>
                        )}
                        {t.use_case && <p className="text-default-400 text-xs">{t.use_case}</p>}
                      </div>
                      <Button
                        size="sm"
                        onPress={() =>
                          handleClone({
                            name: t.name,
                            language: t.language,
                            category: t.category,
                          })
                        }
                        isPending={clone.isPending}
                      >
                        Clonar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
