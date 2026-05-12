import { Button, Card } from "@heroui/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TextAreaInput, TextInput } from "../components/FormField";
import { useCreateCampaign, usePreviewCampaign } from "../hooks/useOutreach";

const DEFAULT_ASUNTO = "Charla educativa gratuita sobre alergias para {{nombre_colegio}}";
const DEFAULT_TEXT = `Estimado/a {{nombre_director}},

Me dirijo a usted en nombre de Bioalergia, centro especializado en alergología e inmunología clínica ubicado en Concepción.

Nos gustaría ofrecerle una charla educativa gratuita para padres, apoderados y/o personal docente de {{nombre_colegio}} sobre alergias respiratorias, alimentarias y el único tratamiento curativo disponible: la inmunoterapia alérgica.

La charla es completamente sin costo, tiene una duración de 45-60 minutos y puede realizarse de forma presencial o virtual.

¿Estarían interesados en coordinar esta actividad?

Atentamente,
Equipo Bioalergia
San Martín 870 Of. 208B, Concepción
+56 41 335 5293 | contacto@bioalergia.cl`;

const DEFAULT_HTML = DEFAULT_TEXT.split("\n\n")
  .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
  .join("\n");

export function OutreachNewCampaignPage() {
  const nav = useNavigate();
  const create = useCreateCampaign();
  const preview = usePreviewCampaign();

  const [nombre, setNombre] = useState("Outreach colegios " + new Date().toISOString().slice(0, 7));
  const [asunto, setAsunto] = useState(DEFAULT_ASUNTO);
  const [cuerpoTexto, setCuerpoTexto] = useState(DEFAULT_TEXT);
  const [cuerpoHtml, setCuerpoHtml] = useState(DEFAULT_HTML);
  const [fromEmail, setFromEmail] = useState("contacto@bioalergia.cl");
  const [fromNombre, setFromNombre] = useState("Equipo Bioalergia");
  const [replyTo, setReplyTo] = useState("contacto@bioalergia.cl");
  const [ratePerHour, setRatePerHour] = useState(50);

  const handlePreview = () =>
    preview.mutate({ filtros: { soloConEmail: true }, asunto, cuerpoHtml, cuerpoTexto });

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const result = await create.mutateAsync({
      nombre,
      asunto,
      cuerpoHtml,
      cuerpoTexto,
      fromEmail,
      fromNombre,
      replyTo,
      ratePerHour,
      filtros: { soloConEmail: true },
    });
    void nav({ to: "/outreach/campanas/$id", params: { id: String(result.campaign.id) } });
  };

  return (
    <div className="space-y-4 p-6">
      <p className="text-default-500 text-sm">
        Variables: <code>{"{{nombre_colegio}}"}</code> <code>{"{{nombre_director}}"}</code>{" "}
        <code>{"{{nombre_contacto}}"}</code> <code>{"{{comuna}}"}</code>
      </p>

      <form onSubmit={handleCreate} className="space-y-4">
        <Card>
          <Card.Header>
            <Card.Title>Configuración</Card.Title>
          </Card.Header>
          <Card.Content className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            <TextInput label="Nombre interno" required value={nombre} onValueChange={setNombre} />
            <div className="md:col-span-2">
              <TextInput label="Asunto" required value={asunto} onValueChange={setAsunto} />
            </div>
            <TextInput
              label="Email remitente"
              type="email"
              required
              value={fromEmail}
              onValueChange={setFromEmail}
            />
            <TextInput
              label="Nombre remitente"
              required
              value={fromNombre}
              onValueChange={setFromNombre}
            />
            <TextInput label="Reply-To" type="email" value={replyTo} onValueChange={setReplyTo} />
            <TextInput
              label="Emails por hora (rate limit)"
              type="number"
              min={1}
              max={500}
              value={ratePerHour}
              onValueChange={(v) => setRatePerHour(Number.parseInt(v || "50", 10))}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Contenido</Card.Title>
          </Card.Header>
          <Card.Content className="space-y-3 p-4">
            <TextAreaInput
              label="Cuerpo (texto plano)"
              rows={10}
              value={cuerpoTexto}
              onValueChange={setCuerpoTexto}
            />
            <TextAreaInput
              label="Cuerpo HTML"
              rows={10}
              value={cuerpoHtml}
              onValueChange={setCuerpoHtml}
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header className="flex items-center justify-between">
            <Card.Title>Vista previa de destinatarios</Card.Title>
            <Button size="sm" variant="secondary" type="button" onPress={handlePreview}>
              Previsualizar
            </Button>
          </Card.Header>
          {preview.data && (
            <Card.Content className="space-y-2 p-4 text-sm">
              <p>
                <strong>{preview.data.totalCandidatos}</strong> candidatos —{" "}
                <span className="text-success">{preview.data.conEmail} con email</span>,{" "}
                <span className="text-warning">{preview.data.sinEmail} sin email</span>
              </p>
              {preview.data.rendered.establecimiento && (
                <div className="rounded bg-default-100 p-3">
                  <p className="text-default-500 text-xs">
                    Muestra: {preview.data.rendered.establecimiento.nombre} (
                    {preview.data.rendered.establecimiento.comuna})
                  </p>
                  <p className="font-medium">{preview.data.rendered.asunto}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs">
                    {preview.data.rendered.cuerpoTexto}
                  </pre>
                </div>
              )}
            </Card.Content>
          )}
        </Card>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" isDisabled={create.isPending}>
            {create.isPending ? "Creando..." : "Crear campaña"}
          </Button>
        </div>
      </form>
    </div>
  );
}
