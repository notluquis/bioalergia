import { Button, Card, Chip, Modal, Spinner, Table } from "@heroui/react";
import {
  CheckCircle2,
  Layers,
  List,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { SelectInput, TextAreaInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  uploadWaMedia,
  useAccounts,
  useArchiveSavedFlow,
  useArchiveSavedInteractiveList,
  useArchiveSavedLocation,
  useArchiveSnippet,
  useSavedFlows,
  useSavedInteractiveLists,
  useSavedLocations,
  useSnippets,
  useSyncFlows,
  useUpsertSavedFlow,
  useUpsertSavedInteractiveList,
  useUpsertSavedLocation,
  useUpsertSnippet,
} from "../hooks/useWaCloud";

type Tab = "locations" | "lists" | "flows" | "snippets";

export function WaCloudCatalogPage() {
  const [tab, setTab] = useState<Tab>("locations");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold text-lg">Catálogo WhatsApp</h2>
      </div>

      <div className="flex gap-2 border-default-200 border-b">
        <TabBtn active={tab === "locations"} onClick={() => setTab("locations")}>
          <MapPin size={14} /> Ubicaciones
        </TabBtn>
        <TabBtn active={tab === "lists"} onClick={() => setTab("lists")}>
          <List size={14} /> Listas interactivas
        </TabBtn>
        <TabBtn active={tab === "flows"} onClick={() => setTab("flows")}>
          <Layers size={14} /> Flows
        </TabBtn>
        <TabBtn active={tab === "snippets"} onClick={() => setTab("snippets")}>
          <Zap size={14} /> Snippets
        </TabBtn>
      </div>

      {tab === "locations" && <LocationsTab />}
      {tab === "lists" && <ListsTab />}
      {tab === "flows" && <FlowsTab />}
      {tab === "snippets" && <SnippetsTab />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2 font-medium text-sm transition ${
        active
          ? "border-success text-success"
          : "border-transparent text-default-500 hover:text-default-700"
      }`}
    >
      {children}
    </button>
  );
}

function LocationsTab() {
  const list = useSavedLocations();
  const archive = useArchiveSavedLocation();
  const [editing, setEditing] = useState<null | {
    id?: number;
    name: string;
    latitude: string;
    longitude: string;
    address: string;
    isDefault: boolean;
  }>(null);
  const items = list.data?.locations ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onPress={() =>
            setEditing({ name: "", latitude: "", longitude: "", address: "", isDefault: false })
          }
        >
          <Plus size={14} /> Nueva ubicación
        </Button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-6 text-center text-default-500 text-sm">
            Sin ubicaciones guardadas.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Ubicaciones">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Coords</Table.Column>
                    <Table.Column>Dirección</Table.Column>
                    <Table.Column>Default</Table.Column>
                    <Table.Column>Acción</Table.Column>
                  </Table.Header>
                  <Table.Body items={items}>
                    {(l) => (
                      <Table.Row id={String(l.id)}>
                        <Table.Cell>
                          <button
                            type="button"
                            className="text-left font-medium text-accent hover:underline"
                            onClick={() =>
                              setEditing({
                                id: l.id,
                                name: l.name,
                                latitude: String(l.latitude),
                                longitude: String(l.longitude),
                                address: l.address ?? "",
                                isDefault: l.isDefault,
                              })
                            }
                          >
                            {l.name}
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="font-mono text-default-500 text-xs">
                            {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="line-clamp-1 text-default-700 text-xs">
                            {l.address ?? "—"}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {l.isDefault && (
                            <Chip size="sm" color="success" variant="soft">
                              <Chip.Label>default</Chip.Label>
                            </Chip>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isIconOnly
                            aria-label="Archivar"
                            onPress={async () => {
                              const ok = await confirmAction({
                                title: "Archivar elemento",
                                description:
                                  "Quedará oculto del catálogo activo. Se puede restaurar luego.",
                                confirmLabel: "Archivar",
                                variant: "danger",
                              });
                              if (!ok) return;
                              archive.mutate(l.id);
                            }}
                          >
                            <Trash2 size={12} />
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
      )}
      {editing && <LocationEditModal target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LocationEditModal({
  target,
  onClose,
}: {
  target: {
    id?: number;
    name: string;
    latitude: string;
    longitude: string;
    address: string;
    isDefault: boolean;
  };
  onClose: () => void;
}) {
  const upsert = useUpsertSavedLocation();
  const [name, setName] = useState(target.name);
  const [lat, setLat] = useState(target.latitude);
  const [lng, setLng] = useState(target.longitude);
  const [address, setAddress] = useState(target.address);
  const [isDefault, setIsDefault] = useState(target.isDefault);

  const useGeo = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalización no soportada");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
      },
      () => toast.error("No se pudo obtener ubicación")
    );
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      toast.error("Lat/lng inválidos");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: target.id,
        name: name.trim(),
        latitude: latN,
        longitude: lngN,
        address: address.trim() || undefined,
        isDefault,
      });
      toast.success("Guardado");
      onClose();
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                {target.id ? "Editar ubicación" : "Nueva ubicación"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <TextInput label="Nombre" value={name} onValueChange={setName} />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Latitud" value={lat} onValueChange={setLat} />
                <TextInput label="Longitud" value={lng} onValueChange={setLng} />
              </div>
              <Button size="sm" variant="outline" onPress={useGeo}>
                <MapPin size={12} /> Usar mi ubicación
              </Button>
              <TextInput label="Dirección" value={address} onValueChange={setAddress} />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.currentTarget.checked)}
                />
                Marcar como default
              </label>
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={upsert.isPending}>
                <CheckCircle2 size={14} />
                Guardar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ListsTab() {
  const list = useSavedInteractiveLists();
  const archive = useArchiveSavedInteractiveList();
  const [editing, setEditing] = useState<null | {
    id?: number;
    name: string;
    description: string;
    headerText: string;
    bodyText: string;
    footerText: string;
    buttonText: string;
    sectionTitle: string;
    rowsRaw: string;
  }>(null);
  const items = list.data?.lists ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          onPress={() =>
            setEditing({
              name: "",
              description: "",
              headerText: "",
              bodyText: "",
              footerText: "",
              buttonText: "Ver opciones",
              sectionTitle: "Opciones",
              rowsRaw: "",
            })
          }
        >
          <Plus size={14} /> Nueva lista
        </Button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-6 text-center text-default-500 text-sm">
            Sin listas guardadas.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Listas">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Botón</Table.Column>
                    <Table.Column>Filas</Table.Column>
                    <Table.Column>Usado</Table.Column>
                    <Table.Column>Acción</Table.Column>
                  </Table.Header>
                  <Table.Body items={items}>
                    {(l) => (
                      <Table.Row id={String(l.id)}>
                        <Table.Cell>
                          <button
                            type="button"
                            className="text-left font-medium text-accent hover:underline"
                            onClick={() => {
                              const rowsText = l.sections
                                .flatMap((s) =>
                                  s.rows.map(
                                    (r) =>
                                      `${r.id}|${r.title}${r.description ? `|${r.description}` : ""}`
                                  )
                                )
                                .join("\n");
                              setEditing({
                                id: l.id,
                                name: l.name,
                                description: l.description ?? "",
                                headerText: l.headerText ?? "",
                                bodyText: l.bodyText,
                                footerText: l.footerText ?? "",
                                buttonText: l.buttonText,
                                sectionTitle: l.sections[0]?.title ?? "Opciones",
                                rowsRaw: rowsText,
                              });
                            }}
                          >
                            {l.name}
                          </button>
                          {l.description && (
                            <p className="text-default-500 text-xs">{l.description}</p>
                          )}
                        </Table.Cell>
                        <Table.Cell>{l.buttonText}</Table.Cell>
                        <Table.Cell>{l.sections.reduce((n, s) => n + s.rows.length, 0)}</Table.Cell>
                        <Table.Cell>{l.hitCount}×</Table.Cell>
                        <Table.Cell>
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isIconOnly
                            aria-label="Archivar"
                            onPress={async () => {
                              const ok = await confirmAction({
                                title: "Archivar elemento",
                                description:
                                  "Quedará oculto del catálogo activo. Se puede restaurar luego.",
                                confirmLabel: "Archivar",
                                variant: "danger",
                              });
                              if (!ok) return;
                              archive.mutate(l.id);
                            }}
                          >
                            <Trash2 size={12} />
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
      )}
      {editing && <ListEditModal target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ListEditModal({
  target,
  onClose,
}: {
  target: {
    id?: number;
    name: string;
    description: string;
    headerText: string;
    bodyText: string;
    footerText: string;
    buttonText: string;
    sectionTitle: string;
    rowsRaw: string;
  };
  onClose: () => void;
}) {
  const upsert = useUpsertSavedInteractiveList();
  const [name, setName] = useState(target.name);
  const [description, setDescription] = useState(target.description);
  const [headerText, setHeaderText] = useState(target.headerText);
  const [bodyText, setBodyText] = useState(target.bodyText);
  const [footerText, setFooterText] = useState(target.footerText);
  const [buttonText, setButtonText] = useState(target.buttonText);
  const [sectionTitle, setSectionTitle] = useState(target.sectionTitle);
  const [rowsRaw, setRowsRaw] = useState(target.rowsRaw);

  const submit = async () => {
    if (!name.trim() || !bodyText.trim() || !buttonText.trim()) {
      toast.error("Nombre, body y botón obligatorios");
      return;
    }
    const lines = rowsRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error("Agrega filas");
      return;
    }
    if (lines.length > 10) {
      toast.error("Máx 10 filas");
      return;
    }
    const rows = lines.map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return {
        id: parts[0] ?? `r${Date.now()}`,
        title: parts[1] ?? parts[0] ?? "Opción",
        description: parts[2] || undefined,
      };
    });
    try {
      await upsert.mutateAsync({
        id: target.id,
        name: name.trim(),
        description: description.trim() || undefined,
        headerText: headerText.trim() || undefined,
        bodyText: bodyText.trim(),
        footerText: footerText.trim() || undefined,
        buttonText: buttonText.trim(),
        sections: [{ title: sectionTitle.trim() || undefined, rows }],
      });
      toast.success("Guardado");
      onClose();
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-lg rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                {target.id ? "Editar lista" : "Nueva lista interactiva"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <TextInput label="Nombre interno" value={name} onValueChange={setName} />
              <TextInput
                label="Descripción interna (opcional)"
                value={description}
                onValueChange={setDescription}
              />
              <TextInput
                label="Encabezado (opcional, máx 60)"
                value={headerText}
                onValueChange={setHeaderText}
              />
              <TextAreaInput
                label="Body (máx 1024)"
                value={bodyText}
                onValueChange={setBodyText}
                rows={2}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Texto botón" value={buttonText} onValueChange={setButtonText} />
                <TextInput
                  label="Título sección"
                  value={sectionTitle}
                  onValueChange={setSectionTitle}
                />
              </div>
              <TextAreaInput
                label="Filas (id|título|descripción opcional, una por línea, máx 10)"
                value={rowsRaw}
                onValueChange={setRowsRaw}
                rows={6}
              />
              <TextInput label="Pie (opcional)" value={footerText} onValueChange={setFooterText} />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} /> Cancelar
              </Button>
              <Button onPress={submit} isPending={upsert.isPending}>
                <CheckCircle2 size={14} /> Guardar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FlowsTab() {
  const list = useSavedFlows();
  const accounts = useAccounts();
  const sync = useSyncFlows();
  const archive = useArchiveSavedFlow();
  const [editing, setEditing] = useState<null | {
    id?: number;
    accountId?: number;
    name: string;
    description: string;
    flowId: string;
    defaultBody: string;
    defaultCta: string;
  }>(null);
  const items = list.data?.flows ?? [];
  const accountOptions = useMemo(
    () =>
      (accounts.data?.accounts ?? []).map((a) => ({
        value: String(a.id),
        label: a.displayName ?? a.wabaId,
      })),
    [accounts.data]
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2">
        <p className="text-default-500 text-xs">
          Los Flows se diseñan en Meta Business Manager. Aquí los sincronizas + agregas defaults.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            isPending={sync.isPending}
            onPress={() => {
              const acc = accounts.data?.accounts?.[0];
              if (!acc) {
                toast.error("Sin cuenta WABA");
                return;
              }
              sync.mutate(acc.id, {
                onSuccess: (r) => toast.success(`Sync OK: ${r.fetched} flows`),
                onError: (e) => toast.error(`Error: ${String(e)}`),
              });
            }}
          >
            <RefreshCw size={14} />
            Sync desde Meta
          </Button>
          <Button
            onPress={() =>
              setEditing({
                name: "",
                description: "",
                flowId: "",
                defaultBody: "",
                defaultCta: "Iniciar",
              })
            }
          >
            <Plus size={14} /> Nuevo manual
          </Button>
        </div>
      </div>

      {list.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-6 text-center text-default-500 text-sm">
            Sin Flows. Click "Sync desde Meta" para importar los aprobados.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Flows">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Flow ID</Table.Column>
                    <Table.Column>Estado Meta</Table.Column>
                    <Table.Column>Categorías</Table.Column>
                    <Table.Column>Acción</Table.Column>
                  </Table.Header>
                  <Table.Body items={items}>
                    {(f) => (
                      <Table.Row id={String(f.id)}>
                        <Table.Cell>
                          <button
                            type="button"
                            className="text-left font-medium text-accent hover:underline"
                            onClick={() =>
                              setEditing({
                                id: f.id,
                                accountId: f.accountId ?? undefined,
                                name: f.name,
                                description: f.description ?? "",
                                flowId: f.flowId,
                                defaultBody: f.defaultBody,
                                defaultCta: f.defaultCta,
                              })
                            }
                          >
                            {f.name}
                          </button>
                        </Table.Cell>
                        <Table.Cell>
                          <code className="text-default-500 text-xs">{f.flowId}</code>
                        </Table.Cell>
                        <Table.Cell>
                          {f.metaStatus ? (
                            <Chip
                              size="sm"
                              color={
                                f.metaStatus === "PUBLISHED"
                                  ? "success"
                                  : f.metaStatus === "DRAFT"
                                    ? "warning"
                                    : "danger"
                              }
                              variant="soft"
                            >
                              <Chip.Label>{f.metaStatus}</Chip.Label>
                            </Chip>
                          ) : (
                            <span className="text-default-400 text-xs">manual</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex flex-wrap gap-1">
                            {f.metaCategories.map((c) => (
                              <Chip key={c} size="sm" variant="soft" color="default">
                                <Chip.Label>{c}</Chip.Label>
                              </Chip>
                            ))}
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isIconOnly
                            aria-label="Archivar"
                            onPress={async () => {
                              const ok = await confirmAction({
                                title: "Archivar elemento",
                                description:
                                  "Quedará oculto del catálogo activo. Se puede restaurar luego.",
                                confirmLabel: "Archivar",
                                variant: "danger",
                              });
                              if (!ok) return;
                              archive.mutate(f.id);
                            }}
                          >
                            <Trash2 size={12} />
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
      )}
      {editing && (
        <FlowEditModal
          target={editing}
          accountOptions={accountOptions}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FlowEditModal({
  target,
  accountOptions,
  onClose,
}: {
  target: {
    id?: number;
    accountId?: number;
    name: string;
    description: string;
    flowId: string;
    defaultBody: string;
    defaultCta: string;
  };
  accountOptions: { value: string; label: string }[];
  onClose: () => void;
}) {
  const upsert = useUpsertSavedFlow();
  const [accountId, setAccountId] = useState(
    target.accountId ? String(target.accountId) : (accountOptions[0]?.value ?? "")
  );
  const [name, setName] = useState(target.name);
  const [description, setDescription] = useState(target.description);
  const [flowId, setFlowId] = useState(target.flowId);
  const [defaultBody, setDefaultBody] = useState(target.defaultBody);
  const [defaultCta, setDefaultCta] = useState(target.defaultCta);

  useEffect(() => {
    if (!accountId && accountOptions[0]) setAccountId(accountOptions[0].value);
  }, [accountOptions, accountId]);

  const submit = async () => {
    if (!name.trim() || !flowId.trim() || !defaultBody.trim() || !defaultCta.trim()) {
      toast.error("Nombre, flow_id, body y CTA obligatorios");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: target.id,
        accountId: accountId ? Number(accountId) : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        flowId: flowId.trim(),
        defaultBody: defaultBody.trim(),
        defaultCta: defaultCta.trim(),
      });
      toast.success("Guardado");
      onClose();
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    }
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                {target.id ? "Editar Flow" : "Nuevo Flow"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-3">
              <SelectInput
                label="Cuenta WABA"
                value={accountId}
                onValueChange={setAccountId}
                options={accountOptions}
              />
              <TextInput
                label="Flow ID (de Meta)"
                value={flowId}
                onValueChange={setFlowId}
                placeholder="123456789012345"
              />
              <TextInput label="Nombre interno" value={name} onValueChange={setName} />
              <TextInput
                label="Descripción (opcional)"
                value={description}
                onValueChange={setDescription}
              />
              <TextAreaInput
                label="Body por defecto"
                value={defaultBody}
                onValueChange={setDefaultBody}
                rows={3}
              />
              <TextInput label="CTA botón" value={defaultCta} onValueChange={setDefaultCta} />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} /> Cancelar
              </Button>
              <Button onPress={submit} isPending={upsert.isPending}>
                <CheckCircle2 size={14} /> Guardar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const SNIPPET_KIND_OPTIONS = [
  { value: "TEXT", label: "Texto" },
  { value: "CTA_URL", label: "Botón URL (CTA)" },
  { value: "REPLY_BUTTONS", label: "Botones reply (max 3)" },
  { value: "MEDIA_DOCUMENT", label: "Documento (PDF/etc)" },
  { value: "MEDIA_IMAGE", label: "Imagen" },
  { value: "MEDIA_VIDEO", label: "Video" },
  { value: "MEDIA_AUDIO", label: "Audio" },
  { value: "MEDIA_STICKER", label: "Sticker" },
];

type SnippetKind =
  | "TEXT"
  | "CTA_URL"
  | "REPLY_BUTTONS"
  | "MEDIA_DOCUMENT"
  | "MEDIA_IMAGE"
  | "MEDIA_VIDEO"
  | "MEDIA_AUDIO"
  | "MEDIA_STICKER";

type SnippetEditState = {
  id?: number;
  kind: SnippetKind;
  category: string;
  name: string;
  description: string;
  shortcut: string;
  bodyText: string;
  ctaUrl: string;
  ctaButtonText: string;
  ctaHeader: string;
  ctaFooter: string;
  replyButtonsRaw: string;
  replyHeader: string;
  replyFooter: string;
  mediaHandle: string;
  mediaUrl: string;
  mediaMimeType: string;
  mediaFilename: string;
  mediaSize: number | null;
};

function emptySnippet(kind: SnippetKind): SnippetEditState {
  return {
    kind,
    category: "",
    name: "",
    description: "",
    shortcut: "",
    bodyText: "",
    ctaUrl: "",
    ctaButtonText: "",
    ctaHeader: "",
    ctaFooter: "",
    replyButtonsRaw: "",
    replyHeader: "",
    replyFooter: "",
    mediaHandle: "",
    mediaUrl: "",
    mediaMimeType: "",
    mediaFilename: "",
    mediaSize: null,
  };
}

function SnippetsTab() {
  const list = useSnippets();
  const archive = useArchiveSnippet();
  const [editing, setEditing] = useState<SnippetEditState | null>(null);
  const items = list.data?.snippets ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onPress={() => setEditing(emptySnippet("TEXT"))}>
          <Plus size={14} /> Nuevo snippet
        </Button>
      </div>
      {list.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <Card>
          <Card.Content className="p-6 text-center text-default-500 text-sm">
            Sin snippets. Crea uno para que las chiquillas tengan respuestas rápidas.
          </Card.Content>
        </Card>
      ) : (
        <Card>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Snippets">
                  <Table.Header>
                    <Table.Column isRowHeader>Nombre</Table.Column>
                    <Table.Column>Tipo</Table.Column>
                    <Table.Column>Categoría</Table.Column>
                    <Table.Column>Atajo</Table.Column>
                    <Table.Column>Usado</Table.Column>
                    <Table.Column>Acción</Table.Column>
                  </Table.Header>
                  <Table.Body items={items}>
                    {(s) => (
                      <Table.Row id={String(s.id)}>
                        <Table.Cell>
                          <button
                            type="button"
                            className="text-left font-medium text-accent hover:underline"
                            onClick={() =>
                              setEditing({
                                id: s.id,
                                kind: s.kind as SnippetKind,
                                category: s.category ?? "",
                                name: s.name,
                                description: s.description ?? "",
                                shortcut: s.shortcut ?? "",
                                bodyText: s.bodyText ?? "",
                                ctaUrl: s.ctaUrl ?? "",
                                ctaButtonText: s.ctaButtonText ?? "",
                                ctaHeader: s.ctaHeader ?? "",
                                ctaFooter: s.ctaFooter ?? "",
                                replyButtonsRaw: (s.replyButtons ?? [])
                                  .map((b) => `${b.id}|${b.title}`)
                                  .join("\n"),
                                replyHeader: s.replyHeader ?? "",
                                replyFooter: s.replyFooter ?? "",
                                mediaHandle: s.mediaHandle ?? "",
                                mediaUrl: s.mediaUrl ?? "",
                                mediaMimeType: s.mediaMimeType ?? "",
                                mediaFilename: s.mediaFilename ?? "",
                                mediaSize: s.mediaSize,
                              })
                            }
                          >
                            {s.name}
                          </button>
                          {s.description && (
                            <p className="text-default-500 text-xs">{s.description}</p>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color="default">
                            <Chip.Label>{s.kind}</Chip.Label>
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>
                          {s.category ? (
                            <Chip size="sm" variant="soft" color="accent">
                              <Chip.Label>{s.category}</Chip.Label>
                            </Chip>
                          ) : (
                            <span className="text-default-400 text-xs">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          {s.shortcut ? (
                            <code className="rounded bg-default-200 px-1 text-[10px]">
                              {s.shortcut}
                            </code>
                          ) : (
                            <span className="text-default-400 text-xs">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>{s.hitCount}×</Table.Cell>
                        <Table.Cell>
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isIconOnly
                            aria-label="Archivar"
                            onPress={async () => {
                              const ok = await confirmAction({
                                title: "Archivar elemento",
                                description:
                                  "Quedará oculto del catálogo activo. Se puede restaurar luego.",
                                confirmLabel: "Archivar",
                                variant: "danger",
                              });
                              if (!ok) return;
                              archive.mutate(s.id);
                            }}
                          >
                            <Trash2 size={12} />
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
      )}
      {editing && <SnippetEditModal target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SnippetEditModal({ target, onClose }: { target: SnippetEditState; onClose: () => void }) {
  const upsert = useUpsertSnippet();
  const accounts = useAccounts();
  const allPhones = useMemo(
    () => (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers),
    [accounts.data]
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [s, setS] = useState<SnippetEditState>(target);
  const [uploading, setUploading] = useState(false);
  const isMedia = s.kind.startsWith("MEDIA_");

  const upload = async (file: File) => {
    if (allPhones.length === 0) {
      toast.error("Sin números WABA. Configura uno primero.");
      return;
    }
    const phoneId = allPhones[0]!.id;
    setUploading(true);
    try {
      const r = await uploadWaMedia(file, phoneId);
      setS((prev) => ({
        ...prev,
        mediaHandle: r.id,
        mediaMimeType: r.mimeType,
        mediaFilename: r.filename,
        mediaSize: file.size,
      }));
      toast.success(`Subido: ${r.filename}`);
    } catch (e) {
      toast.error(`Upload falló: ${String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!s.name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    const input: Parameters<typeof upsert.mutateAsync>[0] = {
      id: s.id,
      kind: s.kind,
      category: s.category.trim() || undefined,
      name: s.name.trim(),
      description: s.description.trim() || undefined,
      shortcut: s.shortcut.trim() || undefined,
      bodyText: s.bodyText.trim() || undefined,
    };
    if (s.kind === "CTA_URL") {
      if (!s.ctaUrl.trim() || !s.ctaButtonText.trim()) {
        toast.error("CTA: url y texto obligatorios");
        return;
      }
      input.ctaUrl = s.ctaUrl.trim();
      input.ctaButtonText = s.ctaButtonText.trim();
      if (s.ctaHeader.trim()) input.ctaHeader = s.ctaHeader.trim();
      if (s.ctaFooter.trim()) input.ctaFooter = s.ctaFooter.trim();
    }
    if (s.kind === "REPLY_BUTTONS") {
      const lines = s.replyButtonsRaw
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0 || lines.length > 3) {
        toast.error("1-3 botones, formato id|título por línea");
        return;
      }
      input.replyButtons = lines.map((line) => {
        const [id, title] = line.split("|").map((p) => p.trim());
        return { id: id ?? `b${Date.now()}`, title: title ?? id ?? "Opción" };
      });
      if (s.replyHeader.trim()) input.replyHeader = s.replyHeader.trim();
      if (s.replyFooter.trim()) input.replyFooter = s.replyFooter.trim();
    }
    if (isMedia) {
      if (!s.mediaHandle && !s.mediaUrl.trim()) {
        toast.error("Sube archivo o pega URL pública");
        return;
      }
      if (s.mediaHandle) input.mediaHandle = s.mediaHandle;
      if (s.mediaUrl.trim()) input.mediaUrl = s.mediaUrl.trim();
      if (s.mediaMimeType) input.mediaMimeType = s.mediaMimeType;
      if (s.mediaFilename) input.mediaFilename = s.mediaFilename;
      if (s.mediaSize) input.mediaSize = s.mediaSize;
    }
    try {
      await upsert.mutateAsync(input);
      toast.success("Guardado");
      onClose();
    } catch (e) {
      toast.error(`Error: ${String(e)}`);
    }
  };

  const set = <K extends keyof SnippetEditState>(k: K, v: SnippetEditState[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-lg rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                {target.id ? "Editar snippet" : "Nuevo snippet"}
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Variables: usa {"{{1}}"}, {"{{2}}"}, … para placeholders.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <SelectInput
                label="Tipo"
                value={s.kind}
                onValueChange={(v) => set("kind", v as SnippetKind)}
                options={SNIPPET_KIND_OPTIONS}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Nombre" value={s.name} onValueChange={(v) => set("name", v)} />
                <TextInput
                  label="Categoría (opcional)"
                  value={s.category}
                  onValueChange={(v) => set("category", v)}
                  placeholder="recetas"
                />
              </div>
              <TextInput
                label="Atajo (opcional, ej /horario)"
                value={s.shortcut}
                onValueChange={(v) => set("shortcut", v)}
              />
              <TextInput
                label="Descripción interna (opcional)"
                value={s.description}
                onValueChange={(v) => set("description", v)}
              />

              {(s.kind === "TEXT" || s.kind === "CTA_URL" || s.kind === "REPLY_BUTTONS") && (
                <TextAreaInput
                  label={s.kind === "TEXT" ? "Mensaje" : "Body (texto del mensaje)"}
                  value={s.bodyText}
                  onValueChange={(v) => set("bodyText", v)}
                  rows={3}
                />
              )}

              {s.kind === "CTA_URL" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label="URL"
                      value={s.ctaUrl}
                      onValueChange={(v) => set("ctaUrl", v)}
                      placeholder="https://bioalergia.cl"
                    />
                    <TextInput
                      label="Texto botón (≤20)"
                      value={s.ctaButtonText}
                      onValueChange={(v) => set("ctaButtonText", v)}
                      placeholder="Reservar"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label="Header (opcional)"
                      value={s.ctaHeader}
                      onValueChange={(v) => set("ctaHeader", v)}
                    />
                    <TextInput
                      label="Footer (opcional)"
                      value={s.ctaFooter}
                      onValueChange={(v) => set("ctaFooter", v)}
                    />
                  </div>
                </>
              )}

              {s.kind === "REPLY_BUTTONS" && (
                <>
                  <TextAreaInput
                    label="Botones (id|título, una por línea, máx 3)"
                    value={s.replyButtonsRaw}
                    onValueChange={(v) => set("replyButtonsRaw", v)}
                    rows={3}
                    placeholder={"confirmar|Confirmar\nreagendar|Reagendar\ncancelar|Cancelar"}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <TextInput
                      label="Header (opcional)"
                      value={s.replyHeader}
                      onValueChange={(v) => set("replyHeader", v)}
                    />
                    <TextInput
                      label="Footer (opcional)"
                      value={s.replyFooter}
                      onValueChange={(v) => set("replyFooter", v)}
                    />
                  </div>
                </>
              )}

              {isMedia && (
                <div className="space-y-2 rounded-lg border border-default-200 bg-content2 p-3">
                  <p className="font-medium text-sm">Archivo</p>
                  <p className="text-default-500 text-xs">
                    Sube el archivo a Meta. El handle vence en 30 días — re-subes después.
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(f);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      isPending={uploading}
                      onPress={() => fileRef.current?.click()}
                    >
                      <Upload size={14} /> Subir archivo
                    </Button>
                  </div>
                  {s.mediaHandle && (
                    <div className="text-xs">
                      <p>
                        <strong>Handle:</strong>{" "}
                        <code className="text-default-500">{s.mediaHandle}</code>
                      </p>
                      <p>
                        <strong>Archivo:</strong> {s.mediaFilename} ({s.mediaMimeType}
                        {s.mediaSize ? `, ${(s.mediaSize / 1024).toFixed(1)} KB` : ""})
                      </p>
                    </div>
                  )}
                  <p className="text-default-500 text-xs">— o pega URL pública —</p>
                  <TextInput
                    label="URL externa (opcional)"
                    value={s.mediaUrl}
                    onValueChange={(v) => set("mediaUrl", v)}
                    placeholder="https://bioalergia.cl/folleto.pdf"
                  />
                  <TextAreaInput
                    label="Caption / pie de foto (opcional)"
                    value={s.bodyText}
                    onValueChange={(v) => set("bodyText", v)}
                    rows={2}
                  />
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} /> Cancelar
              </Button>
              <Button onPress={submit} isPending={upsert.isPending}>
                <CheckCircle2 size={14} /> Guardar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
