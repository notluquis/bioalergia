import { Button, Card, Chip, Modal, Spinner, Table } from "@heroui/react";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useCreateTemplate,
  useDeleteTemplate,
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
      <div className="flex justify-end">
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
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setAccountId("");
      setName("");
      setLanguage("es");
      setCategory("UTILITY");
      setHeaderText("");
      setBodyText("");
      setFooterText("");
    }
  }, [isOpen]);

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
    if (headerText.trim()) {
      components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
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
              <TextInput
                label="Encabezado (opcional, máx 60)"
                value={headerText}
                onValueChange={setHeaderText}
                placeholder="Recordatorio de cita"
              />
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
