import {
  Button,
  Card,
  Chip,
  Form,
  Input,
  Select,
  SelectOption,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Link, useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import type {
  OutreachInteractionType,
  OutreachPriority,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";
import {
  useCreateInteraction,
  useDeleteContact,
  useDeleteInteraction,
  useEstablishment,
  useUpdateEstablishment,
  useUpsertContact,
} from "../hooks/useOutreach";
import { ESTADO_COLOR, ESTADO_LABELS, INTERACCION_LABELS, PRIORIDAD_LABELS } from "../labels";

const ALL_ESTADOS: OutreachStatus[] = [
  "SIN_CONTACTAR",
  "CONTACTADO",
  "SIN_RESPUESTA",
  "RESPONDIO_INTERES",
  "RESPONDIO_MAS_INFO",
  "RESPONDIO_DESISTIO",
  "REUNION_AGENDADA",
  "CONVENIO_FIRMADO",
  "DESCARTADO",
];

const ALL_PRIORIDADES: OutreachPriority[] = ["ALTA", "MEDIA", "BAJA"];

const ALL_INTERACCIONES: OutreachInteractionType[] = [
  "EMAIL_ENVIADO",
  "EMAIL_RECIBIDO",
  "LLAMADA_REALIZADA",
  "LLAMADA_RECIBIDA",
  "WHATSAPP",
  "REUNION_PRESENCIAL",
  "REUNION_ONLINE",
  "CHARLA_REALIZADA",
  "NOTA_INTERNA",
];

export function OutreachEstablishmentDetailPage() {
  const { rbd } = useParams({ from: "/_authed/outreach/establecimientos/$rbd" });
  const { data, isLoading } = useEstablishment(rbd);
  const updateE = useUpdateEstablishment();
  const upsertContact = useUpsertContact();
  const deleteContact = useDeleteContact();
  const createInter = useCreateInteraction();
  const deleteInter = useDeleteInteraction();

  const [notas, setNotas] = useState("");
  const [website, setWebsite] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactDraft, setContactDraft] = useState({
    nombre: "",
    cargo: "",
    email: "",
    telefono: "",
    esPrincipal: false,
  });
  const [showInterForm, setShowInterForm] = useState(false);
  const [interDraft, setInterDraft] = useState({
    tipo: "LLAMADA_REALIZADA" as OutreachInteractionType,
    fecha: dayjs().format("YYYY-MM-DDTHH:mm"),
    contenido: "",
    contactoId: "" as string,
    resultado: "",
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const e = data.establishment;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/outreach/establecimientos"
            className="text-default-500 text-sm hover:underline"
          >
            ← Volver al listado
          </Link>
          <h1 className="font-bold text-2xl">{e.nombre}</h1>
          <p className="text-default-500 text-sm">
            RBD {e.rbd} · {e.comuna}
          </p>
        </div>
        <Chip color={ESTADO_COLOR[e.estado]} variant="flat">
          {ESTADO_LABELS[e.estado]}
        </Chip>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <h2 className="font-semibold">Datos MINEDUC</h2>
          </Card.Header>
          <Card.Body className="space-y-2 text-sm">
            <Field label="Director" value={e.directorMineduc} />
            <Field label="Email" value={e.emailMineduc} />
            <Field label="Teléfono" value={e.telefonoMineduc} />
            <Field label="Dirección" value={e.direccion} />
            <Field label="Matrícula" value={e.matriculaTotal?.toString() ?? null} />
            <Field label="Dependencia" value={e.dependencia} />
            <Field label="Activo" value={e.activo ? "Sí" : "No"} />
          </Card.Body>
        </Card>

        <Card className="lg:col-span-2">
          <Card.Header>
            <h2 className="font-semibold">Estado del outreach</h2>
          </Card.Header>
          <Card.Body className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Select
                label="Estado"
                selectedKey={e.estado}
                onSelectionChange={(k) =>
                  k && updateE.mutate({ rbd: e.rbd, estado: k as OutreachStatus })
                }
                size="sm"
              >
                {ALL_ESTADOS.map((s) => (
                  <SelectOption key={s} id={s}>
                    {ESTADO_LABELS[s]}
                  </SelectOption>
                ))}
              </Select>
              <Select
                label="Prioridad"
                selectedKey={e.prioridad}
                onSelectionChange={(k) =>
                  k && updateE.mutate({ rbd: e.rbd, prioridad: k as OutreachPriority })
                }
                size="sm"
              >
                {ALL_PRIORIDADES.map((p) => (
                  <SelectOption key={p} id={p}>
                    {PRIORIDAD_LABELS[p]}
                  </SelectOption>
                ))}
              </Select>
              <Input
                label="Website"
                value={website || e.websiteUrl || ""}
                onValueChange={setWebsite}
                onBlur={() =>
                  updateE.mutate({ rbd: e.rbd, websiteUrl: website || e.websiteUrl || null })
                }
                size="sm"
              />
              <Input
                label="Etiquetas (separadas por coma)"
                value={e.etiquetas.join(", ")}
                onBlur={(ev) =>
                  updateE.mutate({
                    rbd: e.rbd,
                    etiquetas: ev.currentTarget.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                size="sm"
              />
            </div>
            <Textarea
              label="Notas internas"
              value={notas || e.notas || ""}
              onValueChange={setNotas}
              onBlur={() => updateE.mutate({ rbd: e.rbd, notas: notas || e.notas || null })}
              minRows={3}
            />
          </Card.Body>
        </Card>
      </div>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <h2 className="font-semibold">Contactos ({data.contactos.length})</h2>
          <Button size="sm" variant="flat" onPress={() => setShowContactForm((v) => !v)}>
            {showContactForm ? "Cancelar" : "Agregar contacto"}
          </Button>
        </Card.Header>
        <Card.Body className="space-y-3">
          {showContactForm && (
            <Form
              validationBehavior="aria"
              onSubmit={async (ev) => {
                ev.preventDefault();
                if (!contactDraft.nombre || !contactDraft.cargo) return;
                await upsertContact.mutateAsync({
                  establecimientoRbd: e.rbd,
                  nombre: contactDraft.nombre,
                  cargo: contactDraft.cargo,
                  email: contactDraft.email || null,
                  telefono: contactDraft.telefono || null,
                  esPrincipal: contactDraft.esPrincipal,
                });
                setContactDraft({
                  nombre: "",
                  cargo: "",
                  email: "",
                  telefono: "",
                  esPrincipal: false,
                });
                setShowContactForm(false);
              }}
              className="grid grid-cols-1 gap-2 rounded-medium bg-default-100 p-3 md:grid-cols-2"
            >
              <Input
                label="Nombre"
                isRequired
                value={contactDraft.nombre}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, nombre: v }))}
                size="sm"
              />
              <Input
                label="Cargo"
                isRequired
                value={contactDraft.cargo}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, cargo: v }))}
                size="sm"
              />
              <Input
                label="Email"
                type="email"
                value={contactDraft.email}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, email: v }))}
                size="sm"
              />
              <Input
                label="Teléfono"
                value={contactDraft.telefono}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, telefono: v }))}
                size="sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={contactDraft.esPrincipal}
                  onChange={(ev2) =>
                    setContactDraft((d) => ({ ...d, esPrincipal: ev2.target.checked }))
                  }
                />
                Contacto principal
              </label>
              <div className="md:col-span-2">
                <Button type="submit" color="primary" size="sm">
                  Guardar contacto
                </Button>
              </div>
            </Form>
          )}
          {data.contactos.length === 0 ? (
            <p className="text-default-500 text-sm">Sin contactos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {data.contactos.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded p-2 hover:bg-default-100"
                >
                  <div>
                    <p className="font-medium text-sm">
                      {c.nombre}
                      {c.esPrincipal && (
                        <Chip size="sm" color="primary" variant="flat" className="ml-2">
                          Principal
                        </Chip>
                      )}
                    </p>
                    <p className="text-default-500 text-xs">
                      {c.cargo} · {c.email ?? "sin email"} · {c.telefono ?? "sin tel"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => deleteContact.mutate(c.id)}
                  >
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <h2 className="font-semibold">
            Historial de interacciones ({data.interacciones.length})
          </h2>
          <Button size="sm" variant="flat" onPress={() => setShowInterForm((v) => !v)}>
            {showInterForm ? "Cancelar" : "Registrar interacción"}
          </Button>
        </Card.Header>
        <Card.Body className="space-y-3">
          {showInterForm && (
            <Form
              validationBehavior="aria"
              onSubmit={async (ev) => {
                ev.preventDefault();
                if (!interDraft.contenido) return;
                await createInter.mutateAsync({
                  establecimientoRbd: e.rbd,
                  tipo: interDraft.tipo,
                  fecha: new Date(interDraft.fecha),
                  contenido: interDraft.contenido,
                  contactoId: interDraft.contactoId
                    ? Number.parseInt(interDraft.contactoId, 10)
                    : null,
                  resultado: interDraft.resultado || null,
                });
                setInterDraft({
                  tipo: "LLAMADA_REALIZADA",
                  fecha: dayjs().format("YYYY-MM-DDTHH:mm"),
                  contenido: "",
                  contactoId: "",
                  resultado: "",
                });
                setShowInterForm(false);
              }}
              className="grid grid-cols-1 gap-2 rounded-medium bg-default-100 p-3 md:grid-cols-2"
            >
              <Select
                label="Tipo"
                selectedKey={interDraft.tipo}
                onSelectionChange={(k) =>
                  k && setInterDraft((d) => ({ ...d, tipo: k as OutreachInteractionType }))
                }
                size="sm"
              >
                {ALL_INTERACCIONES.map((t) => (
                  <SelectOption key={t} id={t}>
                    {INTERACCION_LABELS[t]}
                  </SelectOption>
                ))}
              </Select>
              <Input
                type="datetime-local"
                label="Fecha y hora"
                value={interDraft.fecha}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, fecha: v }))}
                size="sm"
              />
              <Select
                label="Contacto"
                selectedKey={interDraft.contactoId || undefined}
                onSelectionChange={(k) =>
                  setInterDraft((d) => ({ ...d, contactoId: (k as string) ?? "" }))
                }
                size="sm"
              >
                <SelectOption id="">Sin contacto</SelectOption>
                {data.contactos.map((c) => (
                  <SelectOption key={c.id} id={String(c.id)}>
                    {c.nombre} ({c.cargo})
                  </SelectOption>
                ))}
              </Select>
              <Input
                label="Resultado"
                value={interDraft.resultado}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, resultado: v }))}
                size="sm"
                placeholder="Ej: Volver a llamar en 1 semana"
              />
              <Textarea
                label="Detalle"
                value={interDraft.contenido}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, contenido: v }))}
                isRequired
                minRows={2}
                className="md:col-span-2"
              />
              <div className="md:col-span-2">
                <Button type="submit" color="primary" size="sm">
                  Registrar
                </Button>
              </div>
            </Form>
          )}
          <div className="space-y-2">
            {data.interacciones.length === 0 ? (
              <p className="text-default-500 text-sm">Sin interacciones registradas.</p>
            ) : (
              data.interacciones.map((i) => (
                <div
                  key={i.id}
                  className="flex items-start justify-between gap-2 rounded border-default-200 border-l-4 p-3 hover:bg-default-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Chip size="sm" variant="flat">
                        {INTERACCION_LABELS[i.tipo]}
                      </Chip>
                      <span className="text-default-500 text-xs">
                        {dayjs(i.fecha).format("DD-MM-YYYY HH:mm")}
                      </span>
                      {i.creadoPorNombre && (
                        <span className="text-default-400 text-xs">· {i.creadoPorNombre}</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm">{i.contenido}</p>
                    {i.resultado && (
                      <p className="mt-1 text-default-500 text-xs">→ {i.resultado}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => deleteInter.mutate(i.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card.Body>
      </Card>

      {data.envios.length > 0 && (
        <Card>
          <Card.Header>
            <h2 className="font-semibold">Emails de campañas ({data.envios.length})</h2>
          </Card.Header>
          <Card.Body className="space-y-1">
            {data.envios.slice(0, 20).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{d.asuntoRender ?? "(sin asunto)"}</span>
                <Chip size="sm" variant="flat">
                  {d.estado}
                </Chip>
              </div>
            ))}
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-default-500">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  );
}
