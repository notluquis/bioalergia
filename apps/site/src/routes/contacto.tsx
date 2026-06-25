import type { CreatePublicContactInput } from "@finanzas/orpc-contracts/public-clinic";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Label,
  Link,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { contactInfo } from "@/data/clinic";
import { publicClinicClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreatePublicContactInput) => publicClinicClient.createContact(input),
  });

  const canSubmit =
    name.trim().length >= 1 &&
    email.includes("@") &&
    message.trim().length >= 1 &&
    consent &&
    !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() ? phone.trim() : null,
      message: message.trim(),
      consent: true,
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="text-lg">¡Gracias por escribirnos!</Card.Title>
          <Card.Description className="text-(--ink-muted) leading-relaxed">
            Recibimos tu mensaje y te responderemos a la brevedad al medio de contacto que nos
            indicaste.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="text-xl">Escríbenos</Card.Title>
        <Card.Description className="text-(--ink-muted) leading-relaxed">
          Para responder tu mensaje te pedimos solo los datos necesarios. No incluyas información de
          salud en este formulario.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <TextField isRequired onChange={setName} value={name}>
            <Label>Nombre</Label>
            <Input maxLength={160} autoComplete="name" />
          </TextField>
          <TextField isRequired onChange={setEmail} value={email}>
            <Label>Correo</Label>
            <Input maxLength={200} placeholder="tu@correo.cl" type="email" autoComplete="email" />
          </TextField>
          <TextField onChange={setPhone} value={phone}>
            <Label>Teléfono (opcional)</Label>
            <Input maxLength={40} placeholder="+56 9 1234 5678" type="tel" autoComplete="tel" />
          </TextField>
          <TextField isRequired onChange={setMessage} value={message}>
            <Label>Mensaje</Label>
            <TextArea
              maxLength={4000}
              placeholder="Cuéntanos tu consulta. No incluyas datos de salud."
              rows={5}
            />
          </TextField>

          <Checkbox isSelected={consent} onChange={setConsent}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <span className="text-sm text-(--ink-muted) leading-relaxed">
                Acepto el tratamiento de mis datos segun la{" "}
                <Link className="text-(--accent)" href="/privacy">
                  Política de Privacidad
                </Link>
                .
              </span>
            </Checkbox.Content>
          </Checkbox>

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
                  No pudimos enviar tu mensaje. Vuelve a intentarlo en unos minutos o escríbenos
                  directamente a {contactInfo.email}.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button isDisabled={!canSubmit} type="submit" variant="primary">
            {submitMutation.isPending ? "Enviando…" : "Enviar mensaje"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function ContactoPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Contacto", path: "/contacto" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Contacto</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Contacto</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">Contacto</h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            ¿Tienes una consulta general o deseas agendar una atención? Escríbenos y te
            responderemos a la brevedad.
          </p>
        </div>
      </section>

      <Section title="Datos de contacto">
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="rounded-3xl" variant="default">
            <Card.Content className="grid gap-3 py-6 text-sm">
              <div className="grid gap-1">
                <span className="font-medium text-(--ink)">Dirección</span>
                <span className="text-(--ink-muted)">{contactInfo.address}</span>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-(--ink)">Teléfonos</span>
                {contactInfo.phones.map((phone) => (
                  <span className="text-(--ink-muted)" key={phone}>
                    {phone}
                  </span>
                ))}
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-(--ink)">Correo</span>
                <Link className="text-(--accent) w-fit" href={`mailto:${contactInfo.email}`}>
                  {contactInfo.email}
                </Link>
              </div>
              <div className="grid gap-1">
                <span className="font-medium text-(--ink)">Horario</span>
                <span className="text-(--ink-muted)">
                  Lunes a sábado, 10:00 a 17:00. Atención con cita previa.
                </span>
              </div>
            </Card.Content>
          </Card>
          <div className="grid gap-6">
            <Alert status="warning">
              <Alert.Content>
                <Alert.Title>No es un servicio de urgencia</Alert.Title>
                <Alert.Description>
                  Bioalergia no es un servicio de urgencia. Ante una emergencia llama al SAMU 131 o
                  acude al servicio de urgencia más cercano.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <Alert status="accent">
              <Alert.Content>
                <Alert.Title>Protección de tus datos</Alert.Title>
                <Alert.Description>
                  No incluyas información de salud en este formulario. Tus datos se tratan conforme
                  a nuestra Política de Protección de Datos (Ley N° 21.719).
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        </div>
      </Section>

      <section className="grid gap-3">
        <ContactForm />
      </section>
    </PageShell>
  );
}

export const Route = createFileRoute("/contacto")({
  component: ContactoPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/contacto`;
    return {
      meta: [
        { title: "Contacto · Bioalergia" },
        {
          name: "description",
          content:
            "Contacta a Bioalergia en Concepción: dirección, teléfonos, correo y horario de atención. Escríbenos tu consulta general o solicitud de hora. No es un servicio de urgencia.",
        },
        { property: "og:title", content: "Contacto · Bioalergia" },
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
