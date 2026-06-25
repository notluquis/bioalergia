import type { CreatePublicDataRightsInput } from "@finanzas/orpc-contracts/public-clinic";
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
import { publicClinicClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

type RightType = CreatePublicDataRightsInput["type"];

const RIGHTS: { id: RightType; label: string; detail: string }[] = [
  {
    id: "ACCESS",
    label: "Acceso",
    detail: "Conocer qué datos suyos tratamos y obtener una copia.",
  },
  {
    id: "RECTIFICATION",
    label: "Rectificación",
    detail: "Corregir datos inexactos o incompletos.",
  },
  {
    id: "DELETION",
    label: "Supresión",
    detail: "Solicitar la eliminación de sus datos cuando proceda.",
  },
  {
    id: "OPPOSITION",
    label: "Oposición",
    detail: "Oponerse a un tratamiento determinado de sus datos.",
  },
  {
    id: "PORTABILITY",
    label: "Portabilidad",
    detail: "Recibir sus datos en un formato estructurado y de uso común.",
  },
  {
    id: "BLOCKING",
    label: "Bloqueo",
    detail: "Suspender temporalmente el tratamiento de un dato.",
  },
];

function DataRightsForm() {
  const [type, setType] = useState<RightType>("ACCESS");
  const [requesterName, setRequesterName] = useState("");
  const [requesterRut, setRequesterRut] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [notes, setNotes] = useState("");
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreatePublicDataRightsInput) =>
      publicClinicClient.createDataRightsRequest(input),
  });

  const canSubmit =
    requesterName.trim().length >= 1 && requesterEmail.includes("@") && !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate({
      type,
      requesterName: requesterName.trim(),
      requesterRut: requesterRut.trim() ? requesterRut.trim() : null,
      requesterEmail: requesterEmail.trim(),
      notes: notes.trim() ? notes.trim() : null,
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="font-display text-2xl text-foreground">
            Recibimos tu solicitud
          </Card.Title>
          <Card.Description className="text-muted leading-relaxed">
            El delegado de protección de datos revisará tu solicitud y te responderá dentro de
            treinta días corridos. Para proteger tus datos, podemos pedir antecedentes que
            verifiquen tu identidad antes de responder.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="font-display text-2xl text-foreground">
          Solicitud de ejercicio de derechos
        </Card.Title>
        <Card.Description className="text-muted leading-relaxed">
          Indica el derecho que deseas ejercer y tus datos de contacto para la respuesta.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <Select
            onChange={(value) => {
              if (value != null) setType(value as RightType);
            }}
            placeholder="Selecciona un derecho"
            value={type}
          >
            <Label>Derecho que deseas ejercer</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {RIGHTS.map((r) => (
                  <ListBox.Item id={r.id} key={r.id} textValue={r.label}>
                    {r.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField isRequired onChange={setRequesterName} value={requesterName}>
            <Label>Nombre completo del titular</Label>
            <Input maxLength={160} autoComplete="name" />
          </TextField>
          <TextField onChange={setRequesterRut} value={requesterRut}>
            <Label>RUN (opcional)</Label>
            <Input maxLength={20} placeholder="12.345.678-9" />
          </TextField>
          <TextField isRequired onChange={setRequesterEmail} value={requesterEmail}>
            <Label>Correo de contacto</Label>
            <Input maxLength={200} placeholder="tu@correo.cl" type="email" autoComplete="email" />
          </TextField>

          <TextField onChange={setNotes} value={notes}>
            <Label>Detalle de tu solicitud (opcional)</Label>
            <TextArea
              maxLength={4000}
              placeholder="Describe tu solicitud. Si actúas en representación, indícalo aquí."
              rows={4}
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
                  escríbenos a contacto@bioalergia.cl.
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
            {submitMutation.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function DerechosPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Ejercicio de derechos", path: "/derechos" },
        ])}
      />
      <PageHeader
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Ejercicio de derechos" }]}
        eyebrow="Protección de datos (Ley 21.719)"
        lede="La Ley N° 21.719 le reconoce derechos sobre sus datos personales. En Bioalergia puede ejercerlos de forma sencilla a través de esta página o escribiendo al delegado de protección de datos."
        title="Ejercicio de derechos del titular"
      />

      <Section title="Qué derechos puede ejercer">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {RIGHTS.map((right) => (
            <Card className="rounded-3xl" key={right.id} variant="default">
              <Card.Header className="gap-2">
                <Card.Title className="font-display text-xl text-foreground">
                  {right.label}
                </Card.Title>
                <Card.Description className="text-muted leading-relaxed">
                  {right.detail}
                </Card.Description>
              </Card.Header>
            </Card>
          ))}
        </div>
        <Card className="rounded-3xl" variant="secondary">
          <Card.Content className="grid gap-3 py-6">
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="mt-2 size-2 rounded-full bg-brand-amber" />
              <span className="text-muted">
                Plazo: respondemos dentro de treinta días corridos contados desde el ingreso de la
                solicitud, prorrogables por una sola vez hasta por treinta días corridos
                adicionales.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="mt-2 size-2 rounded-full bg-brand-amber" />
              <span className="text-muted">
                Verificación de identidad: antes de responder verificamos la identidad de quien
                solicita; si actúa en representación, deberá acreditarla.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="mt-2 size-2 rounded-full bg-brand-amber" />
              <span className="text-muted">
                Límite por ficha clínica: la supresión no procede cuando la conservación es
                necesaria por obligación legal (la ficha clínica se conserva quince años); en esos
                casos puede proceder el bloqueo.
              </span>
            </div>
            <div className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="mt-2 size-2 rounded-full bg-brand-amber" />
              <span className="text-muted">
                Reclamo ante la Agencia: si su solicitud es rechazada o no recibe respuesta, puede
                reclamar ante la Agencia de Protección de Datos Personales dentro de treinta días
                hábiles.
              </span>
            </div>
          </Card.Content>
        </Card>
      </Section>

      <section className="grid gap-3">
        <DataRightsForm />
      </section>
    </PageShell>
  );
}

export const Route = createFileRoute("/derechos")({
  component: DerechosPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/derechos`;
    return {
      meta: [
        { title: "Ejercicio de derechos del titular · Bioalergia" },
        {
          name: "description",
          content:
            "Ejerce tus derechos sobre tus datos personales en Bioalergia conforme a la Ley N° 21.719: acceso, rectificación, supresión, oposición, portabilidad y bloqueo. Respuesta dentro de treinta días corridos.",
        },
        { property: "og:title", content: "Ejercicio de derechos del titular · Bioalergia" },
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
