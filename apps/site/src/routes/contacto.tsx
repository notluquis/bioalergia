import type { CreatePublicContactInput } from "@finanzas/orpc-contracts/public-clinic";
import {
  Alert,
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
import { type FormEvent, type ReactNode, useState } from "react";

import { BookingCta } from "@/components/BookingCta";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { ctaClass } from "@/components/ui/cta";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { PageHero } from "@/components/ui/PageHero";
import { SectionBand } from "@/components/ui/SectionBand";
import { contactInfo } from "@/data/clinic";
import { publicClinicClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { isEmail } from "@/lib/validation";

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
    isEmail(email) &&
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
      <Card className="rounded-2xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="font-display text-2xl text-foreground">
            ¡Gracias por escribirnos!
          </Card.Title>
          <Card.Description className="text-muted leading-relaxed">
            Recibimos tu mensaje y te responderemos a la brevedad al medio de contacto que nos
            indicaste.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="font-display text-2xl text-foreground">Escríbenos</Card.Title>
        <Card.Description className="text-muted leading-relaxed">
          Para responder tu mensaje te pedimos solo los datos necesarios.
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
              <span className="text-sm text-muted leading-relaxed">
                Acepto el tratamiento de mis datos segun la{" "}
                <Link className="text-brand-blue" href="/privacy">
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

          <Button
            className={ctaClass("primary", "w-fit")}
            isDisabled={!canSubmit}
            type="submit"
            variant="primary"
          >
            {submitMutation.isPending ? "Enviando…" : "Enviar mensaje"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-line border-b py-4 last:border-b-0">
      <Eyebrow tone="muted">{label}</Eyebrow>
      {children}
    </div>
  );
}

function ContactoPage() {
  return (
    <PageShell contained={false}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Contacto", path: "/contacto" },
        ])}
      />
      <PageHero
        crumbs={[{ label: "Inicio", href: "/" }, { label: "Contacto" }]}
        eyebrow="Contacto"
        lede="¿Tienes una consulta general o deseas agendar una atención? Escríbenos y te responderemos a la brevedad."
        photo="doctorDesk"
        title="Contacto"
      />

      <SectionBand borderTop tone="surface2">
        <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Eyebrow className="mb-3">Cómo ubicarnos</Eyebrow>
            <h2 className="mb-6 font-display text-[1.75rem] leading-[1.1] text-foreground sm:text-[2rem]">
              Datos de contacto
            </h2>
            <div className="grid text-sm">
              <ContactRow label="Dirección">
                <span className="text-foreground">{contactInfo.address}</span>
              </ContactRow>
              <ContactRow label="Teléfonos">
                {contactInfo.phones.map((phone) => (
                  <Link
                    className="w-fit text-foreground"
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    key={phone}
                  >
                    {phone}
                  </Link>
                ))}
              </ContactRow>
              <ContactRow label="Correo">
                <Link className="w-fit text-brand-blue" href={`mailto:${contactInfo.email}`}>
                  {contactInfo.email}
                </Link>
              </ContactRow>
              <ContactRow label="Horario">
                <span className="text-foreground">
                  {contactInfo.hours} · {contactInfo.hoursNote}
                </span>
              </ContactRow>
            </div>
          </div>
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
      </SectionBand>

      <SectionBand tone="surface">
        <ContactForm />
      </SectionBand>

      <SectionBand borderTop tone="bg">
        <BookingCta
          title="¿Prefieres reservar directamente?"
          description="Si lo que necesitas es agendar una atención, reserva tu hora en Doctoralia o escríbenos por WhatsApp y coordinamos."
          location="contacto_page"
        />
      </SectionBand>
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
