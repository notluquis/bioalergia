import { Button, Card, Checkbox, Chip, Spinner } from "@heroui/react";
import { Link, useParams } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import type {
  OutreachInteractionType,
  OutreachPriority,
  OutreachStatus,
} from "@finanzas/orpc-contracts/outreach";
import { SelectInput, TextAreaInput, TextInput } from "../components/FormField";
import {
  useApolloEnrich,
  useCrawlProspect,
  useCreateInteraction,
  useDeleteContact,
  useDeleteInteraction,
  useEstablishment,
  useHunterDomain,
  useRecomputeScore,
  useUpdateEstablishment,
  useUpsertContact,
} from "../hooks/useOutreach";
import { ESTADO_COLOR, ESTADO_LABELS, INTERACCION_LABELS } from "../labels";

const ESTADO_OPTIONS = [
  { value: "SIN_CONTACTAR", label: "Sin contactar" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "SIN_RESPUESTA", label: "Sin respuesta" },
  { value: "RESPONDIO_INTERES", label: "Interés" },
  { value: "RESPONDIO_MAS_INFO", label: "Pidió más info" },
  { value: "RESPONDIO_DESISTIO", label: "Desistió" },
  { value: "REUNION_AGENDADA", label: "Reunión agendada" },
  { value: "CONVENIO_FIRMADO", label: "Convenio firmado" },
  { value: "DESCARTADO", label: "Descartado" },
];

const PRIORIDAD_OPTIONS = [
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
];

const INTERACCION_OPTIONS = [
  { value: "EMAIL_ENVIADO", label: "Email enviado" },
  { value: "EMAIL_RECIBIDO", label: "Email recibido" },
  { value: "LLAMADA_REALIZADA", label: "Llamada realizada" },
  { value: "LLAMADA_RECIBIDA", label: "Llamada recibida" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "REUNION_PRESENCIAL", label: "Reunión presencial" },
  { value: "REUNION_ONLINE", label: "Reunión online" },
  { value: "CHARLA_REALIZADA", label: "Charla realizada" },
  { value: "NOTA_INTERNA", label: "Nota interna" },
];

export function OutreachEstablishmentDetailPage() {
  const { rbd } = useParams({ from: "/_authed/outreach/establecimientos/$rbd" });
  const { data, isLoading } = useEstablishment(rbd);
  const updateE = useUpdateEstablishment();
  const upsertContact = useUpsertContact();
  const deleteContact = useDeleteContact();
  const createInter = useCreateInteraction();
  const deleteInter = useDeleteInteraction();
  const crawl = useCrawlProspect();
  const apollo = useApolloEnrich();
  const hunter = useHunterDomain();
  const recompute = useRecomputeScore();

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

  const contactoOptions = [
    { value: "", label: "Sin contacto" },
    ...data.contactos.map((c) => ({ value: String(c.id), label: `${c.nombre} (${c.cargo})` })),
  ];

  return (
    <div className="space-y-4 p-6">
      <Link to="/outreach/establecimientos" className="text-default-500 text-sm hover:underline">
        ← Volver al listado
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">{e.nombre}</h2>
          <p className="text-default-500 text-sm">
            {e.rbd} · {e.comuna} · {e.tipo}
          </p>
        </div>
        <Chip color={ESTADO_COLOR[e.estado]} variant="soft">
          {ESTADO_LABELS[e.estado]}
        </Chip>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>Datos</Card.Title>
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
              <SelectInput
                label="Estado"
                value={e.estado}
                onValueChange={(v) => updateE.mutate({ rbd: e.rbd, estado: v as OutreachStatus })}
                options={ESTADO_OPTIONS}
              />
              <SelectInput
                label="Prioridad"
                value={e.prioridad}
                onValueChange={(v) =>
                  updateE.mutate({ rbd: e.rbd, prioridad: v as OutreachPriority })
                }
                options={PRIORIDAD_OPTIONS}
              />
              <TextInput
                label="Website"
                value={websiteValue}
                onValueChange={setWebsite}
                onBlur={() => updateE.mutate({ rbd: e.rbd, websiteUrl: websiteValue || null })}
              />
              <TextInput
                label="Etiquetas (separadas por coma)"
                defaultValue={e.etiquetas.join(", ")}
                value={e.etiquetas.join(", ")}
                onValueChange={(v) =>
                  updateE.mutate({
                    rbd: e.rbd,
                    etiquetas: v
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
            <TextAreaInput
              label="Notas internas"
              rows={3}
              value={notasValue}
              onValueChange={setNotas}
              onBlur={() => updateE.mutate({ rbd: e.rbd, notas: notasValue || null })}
            />
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header className="flex items-center justify-between">
          <div>
            <Card.Title>Enriquecimiento</Card.Title>
            <Card.Description>
              Score: <strong>{e.score}</strong> · Tipo: {e.tipo} · Fuente: {e.fuente}
              {e.dominio && <> · Dominio: {e.dominio}</>}
            </Card.Description>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!e.websiteUrl || crawl.isPending}
              onPress={() => crawl.mutate(e.rbd)}
            >
              {crawl.isPending ? "Crawling..." : "Crawler website"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!e.dominio || apollo.isPending}
              onPress={() => apollo.mutate(e.rbd)}
            >
              {apollo.isPending ? "Apollo..." : "Apollo enrich"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={!e.dominio || hunter.isPending}
              onPress={() => hunter.mutate(e.rbd)}
            >
              {hunter.isPending ? "Hunter..." : "Hunter domain"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={recompute.isPending}
              onPress={() => recompute.mutate(e.rbd)}
            >
              Recalc score
            </Button>
          </div>
        </Card.Header>
        <Card.Content className="space-y-2 p-4 text-xs">
          {e.crawledAt && (
            <p>
              Crawled: {new Date(e.crawledAt).toLocaleString("es-CL")} ·{" "}
              {e.crawlSuccess ? "exitoso" : "sin resultados"}
            </p>
          )}
          {e.apolloLastFetchedAt && (
            <p>Apollo: {new Date(e.apolloLastFetchedAt).toLocaleString("es-CL")}</p>
          )}
          {e.hunterLastFetchedAt && (
            <p>
              Hunter: {new Date(e.hunterLastFetchedAt).toLocaleString("es-CL")}
              {e.hunterEmailPattern && <> · Patrón: {e.hunterEmailPattern}</>}
            </p>
          )}
          {(crawl.isError || apollo.isError || hunter.isError) && (
            <p className="text-danger">
              {(crawl.error as Error)?.message ??
                (apollo.error as Error)?.message ??
                (hunter.error as Error)?.message ??
                "Error"}
            </p>
          )}
        </Card.Content>
      </Card>

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
              className="grid grid-cols-1 gap-3 rounded-medium bg-default-100 p-3 md:grid-cols-2"
            >
              <TextInput
                label="Nombre"
                required
                value={contactDraft.nombre}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, nombre: v }))}
              />
              <TextInput
                label="Cargo"
                required
                value={contactDraft.cargo}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, cargo: v }))}
              />
              <TextInput
                label="Email"
                type="email"
                value={contactDraft.email}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, email: v }))}
              />
              <TextInput
                label="Teléfono"
                value={contactDraft.telefono}
                onValueChange={(v) => setContactDraft((d) => ({ ...d, telefono: v }))}
              />
              <Checkbox
                isSelected={contactDraft.esPrincipal}
                onChange={(v) => setContactDraft((d) => ({ ...d, esPrincipal: v }))}
              >
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>Contacto principal</Checkbox.Content>
              </Checkbox>
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
              className="grid grid-cols-1 gap-3 rounded-medium bg-default-100 p-3 md:grid-cols-2"
            >
              <SelectInput
                label="Tipo"
                value={interDraft.tipo}
                onValueChange={(v) =>
                  setInterDraft((d) => ({ ...d, tipo: v as OutreachInteractionType }))
                }
                options={INTERACCION_OPTIONS}
              />
              <TextInput
                label="Fecha y hora"
                type="datetime-local"
                value={interDraft.fecha}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, fecha: v }))}
              />
              <SelectInput
                label="Contacto"
                value={interDraft.contactoId}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, contactoId: v }))}
                options={contactoOptions}
              />
              <TextInput
                label="Resultado"
                value={interDraft.resultado}
                onValueChange={(v) => setInterDraft((d) => ({ ...d, resultado: v }))}
                placeholder="Ej: Volver a llamar en 1 semana"
              />
              <div className="md:col-span-2">
                <TextAreaInput
                  label="Detalle"
                  rows={3}
                  required
                  value={interDraft.contenido}
                  onValueChange={(v) => setInterDraft((d) => ({ ...d, contenido: v }))}
                />
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
