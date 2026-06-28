import type { CreatePublicComplaintInput } from "@finanzas/orpc-contracts/public-clinic";
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
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { publicClinicClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";

const CATEGORIES = [
  { id: "Reclamo", label: "Reclamo" },
  { id: "Sugerencia", label: "Sugerencia" },
];

const STEPS = [
  {
    title: "Quién puede reclamar",
    body: "Puede presentar un reclamo o una sugerencia la persona atendida, su representante legal o quien la persona designe. El establecimiento no condiciona la atención a la presentación o no de un reclamo.",
  },
  {
    title: "Cómo se presenta",
    body: "Mediante el formulario en línea de esta página, o por escrito en recepción, donde también está disponible el libro de sugerencias y reclamos. Indica tu identificación, un medio de respuesta, una descripción clara del hecho con su fecha y la petición concreta.",
  },
  {
    title: "Plazo de respuesta",
    body: "Respondemos por escrito dentro de quince días hábiles, contados desde el día hábil siguiente a la recepción (Decreto 35, artículo 11). La respuesta se refiere a todas las peticiones formuladas.",
  },
  {
    title: "Superintendencia de Salud",
    body: "Si la respuesta no le satisface, o si no se emite dentro del plazo, puede recurrir a la Intendencia de Prestadores de la Superintendencia de Salud dentro de cinco días hábiles. El establecimiento informa esta vía en su respuesta.",
  },
];

const NOTES = [
  "El reclamo queda registrado con número correlativo asignado por el sistema.",
  "Se conserva copia del reclamo, de la respuesta y del documento que acredite su notificación.",
];

function ComplaintForm() {
  const [complainantName, setComplainantName] = useState("");
  const [complainantRut, setComplainantRut] = useState("");
  const [contact, setContact] = useState("");
  const [category, setCategory] = useState("Reclamo");
  const [description, setDescription] = useState("");
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreatePublicComplaintInput) => publicClinicClient.createComplaint(input),
  });

  const canSubmit =
    complainantName.trim().length >= 1 &&
    contact.trim().length >= 1 &&
    description.trim().length >= 1 &&
    !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate({
      complainantName: complainantName.trim(),
      complainantRut: complainantRut.trim() ? complainantRut.trim() : null,
      contact: contact.trim(),
      category: category.trim() ? category.trim() : null,
      description: description.trim(),
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="font-display text-2xl text-foreground">
            Recibimos tu mensaje
          </Card.Title>
          <Card.Description className="text-muted leading-relaxed">
            Tu reclamo o sugerencia quedó registrado con número correlativo. Te responderemos por
            escrito dentro del plazo legal de quince días hábiles al medio de contacto que nos
            indicaste.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="font-display text-2xl text-foreground">
          Formulario de reclamo o sugerencia
        </Card.Title>
        <Card.Description className="text-muted leading-relaxed">
          Completa los datos para que podamos registrar y responder tu solicitud.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <TextField isRequired onChange={setComplainantName} value={complainantName}>
            <Label>Nombre del reclamante</Label>
            <Input maxLength={160} autoComplete="name" />
          </TextField>
          <TextField onChange={setComplainantRut} value={complainantRut}>
            <Label>RUN (opcional)</Label>
            <Input maxLength={20} placeholder="12.345.678-9" />
          </TextField>
          <TextField isRequired onChange={setContact} value={contact}>
            <Label>Teléfono o correo para respuesta</Label>
            <Input maxLength={200} placeholder="tu@correo.cl o +56 9 1234 5678" />
          </TextField>

          <Select
            onChange={(value) => {
              if (value != null) setCategory(String(value));
            }}
            placeholder="Selecciona el tipo"
            value={category}
          >
            <Label>Tipo: reclamo o sugerencia</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {CATEGORIES.map((c) => (
                  <ListBox.Item id={c.id} key={c.id} textValue={c.label}>
                    {c.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField isRequired onChange={setDescription} value={description}>
            <Label>Descripción del hecho y petición concreta</Label>
            <TextArea
              maxLength={4000}
              placeholder="Describe con claridad el hecho, su fecha y lo que solicitas."
              rows={5}
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
                  No pudimos registrar tu solicitud. Vuelve a intentarlo en unos minutos o
                  preséntala por escrito en recepción.
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
            {submitMutation.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function ReclamosPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Reclamos", path: "/reclamos" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Reclamos" }]}
        eyebrow="Reclamos y sugerencias"
        lede="En Bioalergia recibimos, registramos, respondemos y derivamos los reclamos y sugerencias de las personas conforme al Decreto N° 35 de 2012 y a la Ley N° 20.584, asegurando una respuesta dentro de los plazos legales."
        title="Reclamos y sugerencias"
      />

      <SectionBand borderTop tone="surface2">
        <Eyebrow className="mb-3">El procedimiento</Eyebrow>
        <h2 className="mb-9 max-w-2xl font-display text-[1.875rem] leading-[1.1] text-foreground sm:text-[2.25rem]">
          Cómo funciona
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {STEPS.map((step) => (
            <Card
              className="h-full rounded-2xl border border-line bg-surface"
              key={step.title}
              variant="default"
            >
              <Card.Header className="gap-2">
                <Card.Title className="font-display text-xl text-foreground">
                  {step.title}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {step.body}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
        <ul className="mt-8 grid border-line border-t pt-2">
          {NOTES.map((note) => (
            <li
              className="flex items-start gap-3 border-line border-b py-4 text-[0.95rem] text-muted leading-relaxed last:border-b-0"
              key={note}
            >
              <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-amber" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </SectionBand>

      <SectionBand tone="surface">
        <ComplaintForm />
      </SectionBand>
    </PageShell>
  );
}

export const Route = createFileRoute("/reclamos")({
  component: ReclamosPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/reclamos`;
    return {
      meta: [
        { title: "Reclamos y sugerencias · Bioalergia" },
        {
          name: "description",
          content:
            "Presenta tu reclamo o sugerencia a Bioalergia conforme al Decreto N° 35 de 2012 y la Ley N° 20.584. Respuesta por escrito dentro de quince días hábiles, con derivación a la Superintendencia de Salud.",
        },
        { property: "og:title", content: "Reclamos y sugerencias · Bioalergia" },
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
