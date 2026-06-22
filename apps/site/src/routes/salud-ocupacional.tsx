import type { CreateOccupationalLeadInput } from "@finanzas/orpc-contracts/occupational";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  Chip,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { occupationalClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";
import { Section } from "@/sections/Section";

const LEAD_FORM_ID = "solicitar-informacion";

type Sector = CreateOccupationalLeadInput["sector"];

const SECTORS: { id: Sector; label: string }[] = [
  { id: "MINERIA", label: "Minería" },
  { id: "TRANSPORTE", label: "Transporte" },
  { id: "CONSTRUCCION", label: "Construcción" },
  { id: "GENERAL", label: "General / otros servicios" },
  { id: "OTRO", label: "Otro" },
];

/** Viñeta con punto de acento — patrón de lista compartido en el sitio. */
function Bullet({ children }: { children: string }) {
  return (
    <div className="flex items-start gap-3 text-sm leading-relaxed">
      <span className="mt-2 rounded-full bg-(--accent) size-2" />
      <span className="text-(--ink-muted)">{children}</span>
    </div>
  );
}

/** Cómo funciona + notas de cumplimiento (RIOHS, consentimiento, GC-MS, Ley 21.719). */
function ComplianceSection() {
  return (
    <Section
      eyebrow="Cómo funciona"
      title="Un programa preventivo hecho con respaldo legal"
      subtitle="El testeo de drogas y alcohol en el trabajo es lícito cuando es preventivo, despersonalizado y respeta los derechos del trabajador. Así lo hacemos."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Reglamento Interno (RIOHS)</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              El control debe estar contemplado en el Reglamento Interno de Orden, Higiene y
              Seguridad de la empresa, con carácter preventivo y aplicado de forma despersonalizada
              (por sorteo o universo), no como medida dirigida a un trabajador en particular.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Consentimiento del trabajador</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              La toma de muestra requiere el consentimiento informado del trabajador. Se le explica
              el procedimiento, su finalidad preventiva y el tratamiento que se dará a sus datos.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Confirmación por GC-MS</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Un tamizaje presuntivo positivo nunca se informa como positivo: se confirma siempre
              por cromatografía de gases con espectrometría de masas (GC-MS) antes de entregar
              cualquier resultado, evitando falsos positivos.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Datos sensibles (Ley 21.719)</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Los resultados de salud son datos personales sensibles. Al empleador se le entrega un
              resultado de aptitud (apto / no apto), salvo que el trabajador consienta expresamente
              compartir el detalle. La cadena de custodia y la confidencialidad están aseguradas.
            </Card.Description>
          </Card.Header>
        </Card>
      </div>
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="text-lg">Marco normativo de referencia</Card.Title>
          <Card.Description className="text-(--ink-muted) leading-relaxed">
            El DS 44/2024 establece la obligación de contar con una política preventiva en todo
            lugar de trabajo, lo que respalda la implementación de programas de control de consumo
            de alcohol y drogas.
          </Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 pb-6">
          <Bullet>DS 44/2024 — política preventiva obligatoria en todo lugar de trabajo.</Bullet>
          <Bullet>
            Ley 21.719 — protección de datos personales sensibles (resultados de salud).
          </Bullet>
          <Bullet>
            Confirmación analítica por GC-MS antes de informar cualquier resultado presuntivo.
          </Bullet>
        </Card.Content>
      </Card>
    </Section>
  );
}

/** Cobertura por sector productivo. */
function SectorSection() {
  return (
    <Section
      eyebrow="Cobertura por sector"
      title="Adaptado a tu actividad"
      subtitle="Diseñamos la cadencia y el panel de sustancias según el riesgo y la normativa específica de tu rubro."
    >
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Minería</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Conforme al DS 132, el control puede realizarse a solicitud del supervisor cuando
              existan indicios, además del programa preventivo aleatorio.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Transporte</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Cadencia configurable para conductores y operadores, con foco en alcohol y sustancias
              que afecten la conducción.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Construcción</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Controles preventivos para faenas con maquinaria y trabajo en altura, integrables a tu
              programa de prevención de riesgos.
            </Card.Description>
          </Card.Header>
        </Card>
        <Card className="rounded-3xl" variant="default">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">General</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Servicios, industria y administración: panel estándar de tamizaje y reactivos para tu
              programa preventivo.
            </Card.Description>
          </Card.Header>
        </Card>
      </div>
    </Section>
  );
}

function LeadForm() {
  const [empresa, setEmpresa] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [sector, setSector] = useState<Sector>("GENERAL");
  const [headcount, setHeadcount] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreateOccupationalLeadInput) => occupationalClient.createLead(input),
  });

  const canSubmit =
    empresa.trim().length >= 1 &&
    contactName.trim().length >= 1 &&
    email.includes("@") &&
    !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const headcountValue = Number.parseInt(headcount.trim(), 10);
    submitMutation.mutate({
      empresa: empresa.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim() ? phone.trim() : null,
      rut: rut.trim() ? rut.trim() : null,
      sector,
      headcount: Number.isFinite(headcountValue) && headcountValue >= 1 ? headcountValue : null,
      message: message.trim() ? message.trim() : null,
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="text-lg">¡Gracias! Te contactaremos</Card.Title>
          <Card.Description className="text-(--ink-muted) leading-relaxed">
            Recibimos tu solicitud de salud ocupacional. Nuestro equipo se pondrá en contacto
            contigo a la brevedad para diseñar tu programa preventivo y resolver tus dudas.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="text-xl">Solicitar información</Card.Title>
        <Card.Description className="text-(--ink-muted) leading-relaxed">
          Cuéntanos sobre tu empresa y te enviaremos una propuesta de programa preventivo a la
          medida, sin compromiso.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <TextField isRequired onChange={setEmpresa} value={empresa}>
            <Label>Empresa</Label>
            <Input maxLength={200} placeholder="Nombre de tu empresa" autoComplete="organization" />
          </TextField>
          <TextField isRequired onChange={setContactName} value={contactName}>
            <Label>Nombre de contacto</Label>
            <Input maxLength={120} autoComplete="name" />
          </TextField>
          <TextField isRequired onChange={setEmail} value={email}>
            <Label>Email</Label>
            <Input maxLength={160} placeholder="tu@empresa.cl" type="email" autoComplete="email" />
          </TextField>
          <TextField onChange={setPhone} value={phone}>
            <Label>Teléfono (opcional)</Label>
            <Input maxLength={40} placeholder="+56 9 1234 5678" type="tel" autoComplete="tel" />
          </TextField>
          <TextField onChange={setRut} value={rut}>
            <Label>RUT de la empresa (opcional)</Label>
            <Input maxLength={20} placeholder="76.123.456-7" />
          </TextField>

          <Select
            onChange={(value) => {
              if (value != null) setSector(value as Sector);
            }}
            placeholder="Selecciona un sector"
            value={sector}
          >
            <Label>Sector</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SECTORS.map((s) => (
                  <ListBox.Item id={s.id} key={s.id} textValue={s.label}>
                    {s.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>

          <TextField onChange={setHeadcount} value={headcount}>
            <Label>Dotación de trabajadores (opcional)</Label>
            <Input inputMode="numeric" min={1} placeholder="Ej: 120" type="number" />
          </TextField>

          <TextField onChange={setMessage} value={message}>
            <Label>Mensaje (opcional)</Label>
            <TextArea maxLength={2000} placeholder="Cuéntanos qué necesitas…" rows={4} />
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
                  No pudimos enviar tu solicitud. Vuelve a intentarlo en unos minutos o escríbenos
                  directamente.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button isDisabled={!canSubmit} type="submit" variant="primary">
            {submitMutation.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function SaludOcupacionalPage() {
  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Salud ocupacional", path: "/salud-ocupacional" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Salud ocupacional</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">
            Salud ocupacional B2B
          </div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Salud ocupacional para empresas
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Testeo de drogas y alcohol y reactivos para tu programa preventivo. El{" "}
            <span className="font-semibold text-(--ink)">DS 44/2024</span> exige una política
            preventiva en todo lugar de trabajo: te ayudamos a implementarla con respaldo analítico
            y resguardo de los datos de tus trabajadores.
          </p>
          <div className="flex flex-wrap gap-2">
            <Chip size="sm" variant="secondary">
              Confirmación GC-MS
            </Chip>
            <Chip size="sm" variant="secondary">
              Cadena de custodia
            </Chip>
            <Chip size="sm" variant="secondary">
              Ley 21.719
            </Chip>
            <Chip size="sm" variant="secondary">
              Reactivos incluidos
            </Chip>
          </div>
          <div>
            <Button onPress={() => scrollToForm()} variant="primary">
              Solicitar información
            </Button>
          </div>
        </div>
      </section>

      <ComplianceSection />
      <SectorSection />

      <Section title="Reactivos para tu programa">
        <Card className="rounded-3xl" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title className="text-lg">Insumos y reactivos de tamizaje</Card.Title>
            <Card.Description className="text-(--ink-muted) leading-relaxed">
              Además del servicio de testeo, suministramos los reactivos e insumos para programas de
              control de drogas y alcohol, con respaldo regulatorio y trazabilidad.
            </Card.Description>
          </Card.Header>
          <Card.Content className="pb-6">
            <Separator className="mb-4" />
            <Button onPress={() => scrollToForm()} variant="secondary">
              Solicitar cotización
            </Button>
          </Card.Content>
        </Card>
      </Section>

      <section className="grid gap-3 scroll-mt-24" id={LEAD_FORM_ID}>
        <LeadForm />
      </section>
    </PageShell>
  );
}

function scrollToForm() {
  const el = document.getElementById(LEAD_FORM_ID);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const Route = createFileRoute("/salud-ocupacional")({
  component: SaludOcupacionalPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/salud-ocupacional`;
    return {
      meta: [
        { title: "Salud ocupacional para empresas · Bioalergia" },
        {
          name: "description",
          content:
            "Testeo de drogas y alcohol ocupacional en Concepción para empresas: programa preventivo conforme al DS 44/2024, confirmación por GC-MS, cadena de custodia y resguardo de datos sensibles (Ley 21.719), más reactivos para tu programa de control.",
        },
        { property: "og:title", content: "Salud ocupacional para empresas · Bioalergia" },
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
