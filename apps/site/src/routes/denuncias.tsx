import type { CreateKarinReportInput, KarinReportType } from "@finanzas/orpc-contracts/karin";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { ctaClass } from "@/components/ui/cta";
import { PageHeader } from "@/components/ui/PageHeader";
import { karinClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

const REPORT_TYPES: { id: KarinReportType; label: string }[] = [
  { id: "ACOSO_LABORAL", label: "Acoso laboral" },
  { id: "ACOSO_SEXUAL", label: "Acoso sexual" },
  { id: "VIOLENCIA", label: "Violencia en el trabajo" },
];

function Bullet({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-3 text-sm leading-relaxed">
      <span className="mt-2 size-2 rounded-full bg-brand-amber" />
      <span className="text-muted">{children}</span>
    </div>
  );
}

function KarinForm() {
  const [reportType, setReportType] = useState<KarinReportType>("ACOSO_LABORAL");
  const [reporterName, setReporterName] = useState("");
  const [reporterRut, setReporterRut] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [reportedPerson, setReportedPerson] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [description, setDescription] = useState("");
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreateKarinReportInput) => karinClient.createReport(input),
  });

  // Denuncia IDENTIFICADA (Ley Karin): nombre + contacto obligatorios.
  const canSubmit =
    reporterName.trim().length >= 1 &&
    reporterContact.trim().length >= 1 &&
    description.trim().length >= 1 &&
    !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate({
      reportType,
      reporterName: reporterName.trim(),
      reporterRut: reporterRut.trim() || undefined,
      reporterContact: reporterContact.trim(),
      reportedPerson: reportedPerson.trim() || undefined,
      occurredAt: occurredAt.trim() || undefined,
      description: description.trim(),
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="font-display text-2xl text-foreground">
            Denuncia recibida
          </Card.Title>
          <Card.Description className="text-muted leading-relaxed">
            Tu denuncia quedó registrada de forma confidencial. La persona encargada adoptará las
            medidas de resguardo que correspondan y te contactará por el medio que indicaste. Si lo
            prefieres, también puedes acudir directamente a la Inspección del Trabajo.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="font-display text-2xl text-foreground">
          Formulario de denuncia (Anexo A)
        </Card.Title>
        <Card.Description className="text-muted leading-relaxed">
          La denuncia es identificada: para iniciar la investigación reglada necesitamos tu nombre y
          un medio de contacto. La información se trata con reserva y acceso restringido.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <Select
            onChange={(value) => {
              if (value != null) setReportType(value as KarinReportType);
            }}
            placeholder="Selecciona el tipo"
            value={reportType}
          >
            <Label>Tipo de conducta denunciada</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {REPORT_TYPES.map((t) => (
                  <ListBox.Item id={t.id} key={t.id} textValue={t.label}>
                    {t.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField isRequired onChange={setReporterName} value={reporterName}>
            <Label>Nombre del denunciante</Label>
            <Input maxLength={160} autoComplete="name" />
          </TextField>
          <TextField onChange={setReporterRut} value={reporterRut}>
            <Label>RUN (opcional)</Label>
            <Input maxLength={20} placeholder="12.345.678-9" />
          </TextField>
          <TextField isRequired onChange={setReporterContact} value={reporterContact}>
            <Label>Teléfono o correo para contacto</Label>
            <Input maxLength={200} placeholder="tu@correo.cl o +56 9 1234 5678" />
          </TextField>
          <TextField onChange={setReportedPerson} value={reportedPerson}>
            <Label>Persona o personas denunciadas (opcional)</Label>
            <Input maxLength={200} placeholder="Nombre o cargo" />
          </TextField>
          <TextField onChange={setOccurredAt} value={occurredAt}>
            <Label>Fecha del hecho (opcional)</Label>
            <Input max="2100-12-31" type="date" />
          </TextField>

          <TextField isRequired onChange={setDescription} value={description}>
            <Label>Relato de los hechos</Label>
            <TextArea
              maxLength={4000}
              placeholder="Describe qué ocurrió, cuándo y dónde, quiénes participaron y si hay testigos."
              rows={6}
            />
          </TextField>

          {/* Honeypot anti-spam: invisible para humanos, los bots lo llenan. */}
          <div aria-hidden="true" className="absolute left-[-9999px] size-0 overflow-hidden">
            <label htmlFor="website-hp">No llenar este campo</label>
            <input
              aria-label="No llenar este campo"
              autoComplete="off"
              id="website-hp"
              name="website"
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              type="text"
              value={website}
            />
          </div>

          {submitMutation.isError ? (
            <Alert status="danger">
              <Alert.Content>
                <Alert.Description>
                  No pudimos registrar tu denuncia. Vuelve a intentarlo en unos minutos o escribe
                  directamente a denuncias@bioalergia.cl.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button
            className={ctaClass("primary", "w-fit")}
            isDisabled={!canSubmit}
            type="submit"
            variant="primary"
          >
            {submitMutation.isPending ? "Enviando…" : "Enviar denuncia"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function DenunciasPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Canal de denuncias", path: "/denuncias" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Canal de denuncias" }]}
        eyebrow="Ley Karin"
        lede="Bioalergia cuenta con un canal para denunciar acoso laboral, acoso sexual y violencia en el trabajo, conforme a la Ley N° 21.643 y al Decreto N° 21 de 2024. Está dirigido al personal del establecimiento. La denuncia se recibe de forma identificada y se trata con reserva."
        title="Canal de denuncias Ley Karin"
      />

      <Section title="Cómo funciona">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-xl text-foreground">
                Denuncia identificada
              </Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                Para iniciar la investigación reglada, la denuncia debe individualizar a quien la
                presenta (nombre y contacto). Una denuncia anónima puede recibirse como antecedente,
                pero por sí sola no inicia la investigación.
              </Card.Description>
            </Card.Header>
          </Card>
          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-xl text-foreground">
                Reserva y resguardo
              </Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                La información tiene acceso restringido a quien recibe y gestiona la denuncia. Se
                adoptan medidas de resguardo inmediatas para proteger a la persona afectada durante
                el procedimiento.
              </Card.Description>
            </Card.Header>
          </Card>
          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-xl text-foreground">Plazos</Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                Resguardo inmediato, remisión a la Inspección del Trabajo dentro de tres días
                hábiles e investigación en un plazo de treinta días hábiles, según corresponda al
                procedimiento elegido.
              </Card.Description>
            </Card.Header>
          </Card>
          <Card className="rounded-3xl" variant="default">
            <Card.Header className="gap-2">
              <Card.Title className="font-display text-xl text-foreground">
                Vías alternativas
              </Card.Title>
              <Card.Description className="text-muted leading-relaxed">
                Puedes usar este formulario, escribir a denuncias@bioalergia.cl o acudir
                directamente a la Inspección del Trabajo. La elección de la vía es tuya.
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Content className="grid gap-3 py-6">
            <Bullet>La denuncia queda registrada con trazabilidad y acceso restringido.</Bullet>
            <Bullet>
              No se admiten represalias contra quien denuncia o participa de buena fe en la
              investigación.
            </Bullet>
          </Card.Content>
        </Card>
      </Section>

      <section className="grid gap-3">
        <KarinForm />
      </section>
    </PageShell>
  );
}

export const Route = createFileRoute("/denuncias")({
  component: DenunciasPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/denuncias`;
    return {
      meta: [
        { title: "Canal de denuncias Ley Karin · Bioalergia" },
        {
          name: "description",
          content:
            "Canal de denuncia de acoso laboral, acoso sexual y violencia en el trabajo de Bioalergia, conforme a la Ley N° 21.643 y el Decreto N° 21 de 2024. Denuncia identificada y confidencial.",
        },
        { property: "og:title", content: "Canal de denuncias Ley Karin · Bioalergia" },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:image", content: `${origin}/og-image.png` },
        { name: "twitter:image", content: `${origin}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});
