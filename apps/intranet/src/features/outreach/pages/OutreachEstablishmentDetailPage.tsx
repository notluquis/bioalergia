import { Button, Card, Chip, Spinner } from "@heroui/react";
import { Link, useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import type {
  OutreachInteractionType,
  OutreachPriority,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";
import { Field, NativeSelect, TextAreaInput, TextInput } from "../components/FormField";
import {
  useCreateInteraction,
  useDeleteContact,
  useDeleteInteraction,
  useEstablishment,
  useUpdateEstablishment,
  useUpsertContact,
} from "../hooks/useOutreach";
import { ESTADO_COLOR, ESTADO_LABELS, INTERACCION_LABELS } from "../labels";

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

  const [notas, setNotas] = useState<string | null>(null);
  const [website, setWebsite] = useState<string | null>(null);
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
    contactoId: "",
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
  const notasValue = notas ?? e.notas ?? "";
  const websiteValue = website ?? e.websiteUrl ?? "";

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
        <Chip color={ESTADO_COLOR[e.estado]} variant="soft">
          {ESTADO_LABELS[e.estado]}
        </Chip>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Datos MINEDUC</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-2 p-4 text-sm">
            <Row label="Director" value={e.directorMineduc} />
            <Row label="Email" value={e.emailMineduc} />
            <Row label="Teléfono" value={e.telefonoMineduc} />
            <Row label="Dirección" value={e.direccion} />
            <Row label="Matrícula" value={e.matriculaTotal?.toString() ?? null} />
            <Row label="Dependencia" value={e.dependencia} />
            <Row label="Activo" value={e.activo ? "Sí" : "No"} />
          </Card.Content>
        </Card>

        <Card className="lg:col-span-2">
          <Card.Header>
            <Card.Title>Estado del outreach</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Estado">
                <NativeSelect
                  value={e.estado}
                  onChange={(ev) =>
                    updateE.mutate({ rbd: e.rbd, estado: ev.target.value as OutreachStatus })
                  }
                >
                  {ALL_ESTADOS.map((s) => (
                    <option key={s} value={s}>
                      {ESTADO_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Prioridad">
                <NativeSelect
                  value={e.prioridad}
                  onChange={(ev) =>
                    updateE.mutate({ rbd: e.rbd, prioridad: ev.target.value as OutreachPriority })
                  }
                >
                  {ALL_PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Website">
                <TextInput
                  value={websiteValue}
                  onChange={(ev) => setWebsite(ev.target.value)}
                  onBlur={() => updateE.mutate({ rbd: e.rbd, websiteUrl: websiteValue || null })}
                />
              </Field>
              <Field label="Etiquetas (separadas por coma)">
                <TextInput
                  defaultValue={e.etiquetas.join(", ")}
                  onBlur={(ev) =>
                    updateE.mutate({
                      rbd: e.rbd,
                      etiquetas: ev.currentTarget.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Notas internas">
              <TextAreaInput
                rows={3}
                value={notasValue}
                onChange={(ev) => setNotas(ev.target.value)}
                onBlur={() => updateE.mutate({ rbd: e.rbd, notas: notasValue || null })}
              />
            </Field>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <Card.Title>Contactos ({data.contactos.length})</Card.Title>
          <Button size="sm" variant="secondary" onPress={() => setShowContactForm((v) => !v)}>
            {showContactForm ? "Cancelar" : "Agregar contacto"}
          </Button>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          {showContactForm && (
            <form
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
              <Field label="Nombre">
                <TextInput
                  required
                  value={contactDraft.nombre}
                  onChange={(ev) => setContactDraft((d) => ({ ...d, nombre: ev.target.value }))}
                />
              </Field>
              <Field label="Cargo">
                <TextInput
                  required
                  value={contactDraft.cargo}
                  onChange={(ev) => setContactDraft((d) => ({ ...d, cargo: ev.target.value }))}
                />
              </Field>
              <Field label="Email">
                <TextInput
                  type="email"
                  value={contactDraft.email}
                  onChange={(ev) => setContactDraft((d) => ({ ...d, email: ev.target.value }))}
                />
              </Field>
              <Field label="Teléfono">
                <TextInput
                  value={contactDraft.telefono}
                  onChange={(ev) => setContactDraft((d) => ({ ...d, telefono: ev.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={contactDraft.esPrincipal}
                  onChange={(ev) =>
                    setContactDraft((d) => ({ ...d, esPrincipal: ev.target.checked }))
                  }
                />
                Contacto principal
              </label>
              <div className="md:col-span-2">
                <Button type="submit" variant="primary" size="sm">
                  Guardar contacto
                </Button>
              </div>
            </form>
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
                        <Chip size="sm" color="accent" variant="soft" className="ml-2">
                          Principal
                        </Chip>
                      )}
                    </p>
                    <p className="text-default-500 text-xs">
                      {c.cargo} · {c.email ?? "sin email"} · {c.telefono ?? "sin tel"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onPress={() => deleteContact.mutate(c.id)}>
                    Eliminar
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <Card.Title>Historial de interacciones ({data.interacciones.length})</Card.Title>
          <Button size="sm" variant="secondary" onPress={() => setShowInterForm((v) => !v)}>
            {showInterForm ? "Cancelar" : "Registrar interacción"}
          </Button>
        </Card.Header>
        <Card.Content className="space-y-3 p-4">
          {showInterForm && (
            <form
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
              <Field label="Tipo">
                <NativeSelect
                  value={interDraft.tipo}
                  onChange={(ev) =>
                    setInterDraft((d) => ({
                      ...d,
                      tipo: ev.target.value as OutreachInteractionType,
                    }))
                  }
                >
                  {ALL_INTERACCIONES.map((t) => (
                    <option key={t} value={t}>
                      {INTERACCION_LABELS[t]}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Fecha y hora">
                <TextInput
                  type="datetime-local"
                  value={interDraft.fecha}
                  onChange={(ev) => setInterDraft((d) => ({ ...d, fecha: ev.target.value }))}
                />
              </Field>
              <Field label="Contacto">
                <NativeSelect
                  value={interDraft.contactoId}
                  onChange={(ev) => setInterDraft((d) => ({ ...d, contactoId: ev.target.value }))}
                >
                  <option value="">Sin contacto</option>
                  {data.contactos.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nombre} ({c.cargo})
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Resultado">
                <TextInput
                  value={interDraft.resultado}
                  onChange={(ev) => setInterDraft((d) => ({ ...d, resultado: ev.target.value }))}
                  placeholder="Ej: Volver a llamar en 1 semana"
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Detalle">
                  <TextAreaInput
                    rows={3}
                    required
                    value={interDraft.contenido}
                    onChange={(ev) => setInterDraft((d) => ({ ...d, contenido: ev.target.value }))}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" variant="primary" size="sm">
                  Registrar
                </Button>
              </div>
            </form>
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
                      <Chip size="sm" variant="soft">
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
                  <Button size="sm" variant="ghost" onPress={() => deleteInter.mutate(i.id)}>
                    Eliminar
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card.Content>
      </Card>

      {data.envios.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Emails de campañas ({data.envios.length})</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-1 p-4">
            {data.envios.slice(0, 20).map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{d.asuntoRender ?? "(sin asunto)"}</span>
                <Chip size="sm" variant="soft">
                  {d.estado}
                </Chip>
              </div>
            ))}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-default-500">{label}</span>
      <span className="text-right">{value ?? "—"}</span>
    </div>
  );
}
