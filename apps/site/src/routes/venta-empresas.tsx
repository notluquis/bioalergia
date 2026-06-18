import type {
  CreateReactivoLeadInput,
  ReactivoVitrinaItemDto,
} from "@finanzas/orpc-contracts/reactivos";
import {
  Alert,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  Chip,
  Form,
  Input,
  Label,
  Separator,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useMemo, useState } from "react";

import { ContentError, ContentLoading } from "@/components/ContentState";
import { JsonLd } from "@/components/JsonLd";
import { PageShell } from "@/components/PageShell";
import { reactivosClient } from "@/lib/orpc-client";
import { breadcrumbJsonLd } from "@/lib/seo";

const LEAD_FORM_ID = "quiero-reactivos";

/** Agrupa los ítems de la vitrina por categoría (fallback a la marca). */
function groupItems(items: ReactivoVitrinaItemDto[]): [string, ReactivoVitrinaItemDto[]][] {
  const groups = new Map<string, ReactivoVitrinaItemDto[]>();
  for (const item of items) {
    const key = item.category ?? item.brand ?? "Reactivos";
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()];
}

function VitrinaCard({ item }: { item: ReactivoVitrinaItemDto }) {
  return (
    <Card className="rounded-3xl" variant="default">
      {item.imageUrl ? (
        <img
          alt={item.name}
          className="h-44 w-full rounded-t-3xl object-cover"
          loading="lazy"
          src={item.imageUrl}
        />
      ) : null}
      <Card.Header className="gap-3">
        <div className="flex items-center justify-between gap-3">
          <Card.Title className="text-lg">{item.name}</Card.Title>
          {item.brand ? (
            <Chip size="sm" variant="secondary">
              {item.brand}
            </Chip>
          ) : null}
        </div>
        {item.description ? (
          <Card.Description className="text-(--ink-muted) leading-relaxed">
            {item.description}
          </Card.Description>
        ) : null}
      </Card.Header>
      <Card.Content className="grid gap-3 pb-6">
        {item.format ? (
          <div className="text-(--ink-muted) text-sm">
            <span className="font-semibold text-(--ink)">Formato:</span> {item.format}
          </div>
        ) : null}
        {item.allergen ? (
          <div className="grid gap-1 rounded-2xl bg-(--surface-2) p-4 text-sm leading-relaxed">
            <span className="font-semibold text-(--ink)">Alérgeno</span>
            <span className="text-(--ink-muted)">
              {item.allergen.commonName}
              {item.allergen.scientificName ? (
                <em className="text-(--ink-muted)"> · {item.allergen.scientificName}</em>
              ) : null}
            </span>
          </div>
        ) : null}
      </Card.Content>
    </Card>
  );
}

function LeadForm({ vitrinaItems }: { vitrinaItems: ReactivoVitrinaItemDto[] }) {
  const [empresa, setEmpresa] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rut, setRut] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Honeypot — los humanos nunca lo ven ni lo llenan.
  const [website, setWebsite] = useState("");

  const submitMutation = useMutation({
    mutationFn: (input: CreateReactivoLeadInput) => reactivosClient.createLead(input),
  });

  const toggleProduct = (name: string, isSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const canSubmit =
    empresa.trim().length >= 1 &&
    contactName.trim().length >= 1 &&
    email.includes("@") &&
    !submitMutation.isPending;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate({
      empresa: empresa.trim(),
      contactName: contactName.trim(),
      email: email.trim(),
      phone: phone.trim() ? phone.trim() : null,
      rut: rut.trim() ? rut.trim() : null,
      message: message.trim() ? message.trim() : null,
      productsOfInterest: [...selected],
      website,
    });
  };

  if (submitMutation.isSuccess) {
    return (
      <Card className="rounded-3xl" variant="secondary">
        <Card.Header className="gap-2">
          <Card.Title className="text-lg">¡Gracias! Te contactaremos</Card.Title>
          <Card.Description className="text-(--ink-muted) leading-relaxed">
            Recibimos tu solicitud de reactivos. Nuestro equipo comercial se pondrá en contacto
            contigo a la brevedad para enviarte la cotización y resolver tus dudas.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl" variant="default">
      <Card.Header className="gap-2">
        <Card.Title className="text-xl">Quiero reactivos</Card.Title>
        <Card.Description className="text-(--ink-muted) leading-relaxed">
          Cuéntanos sobre tu empresa o clínica y qué reactivos te interesan. Te enviaremos una
          cotización personalizada sin compromiso.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="grid gap-4" onSubmit={onSubmit} validationBehavior="aria">
          <TextField isRequired onChange={setEmpresa} value={empresa}>
            <Label>Empresa o clínica</Label>
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

          {vitrinaItems.length > 0 ? (
            <div className="grid gap-2">
              <Label>Reactivos de interés (opcional)</Label>
              <div className="grid max-h-60 gap-2 overflow-y-auto rounded-2xl bg-(--surface-2) p-4">
                {vitrinaItems.map((item) => (
                  <Checkbox
                    isSelected={selected.has(item.name)}
                    key={item.id}
                    onChange={(isSelected) => toggleProduct(item.name, isSelected)}
                  >
                    {item.name}
                  </Checkbox>
                ))}
              </div>
            </div>
          ) : null}

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

function VentaEmpresasPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reactivos-vitrina"],
    queryFn: () => reactivosClient.listVitrina(),
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const groups = useMemo(() => groupItems(items), [items]);

  return (
    <PageShell>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", path: "/" },
          { name: "Venta a empresas", path: "/venta-empresas" },
        ])}
      />
      <section className="grid gap-4">
        <Breadcrumbs>
          <Breadcrumbs.Item href="/">Inicio</Breadcrumbs.Item>
          <Breadcrumbs.Item>Venta a empresas</Breadcrumbs.Item>
        </Breadcrumbs>
        <div className="grid gap-3">
          <div className="text-(--ink-muted) text-xs uppercase tracking-[0.2em]">Venta B2B</div>
          <h1 className="font-semibold text-(--ink) text-3xl sm:text-4xl">
            Reactivos y extractos alergénicos para empresas
          </h1>
          <p className="max-w-3xl text-(--ink-muted) text-base leading-relaxed sm:text-lg">
            Distribuimos reactivos para pruebas cutáneas y extractos alergénicos a clínicas,
            laboratorios y centros médicos. Revisa nuestra vitrina y solicita una cotización a la
            medida de tu institución.
          </p>
          <div>
            <Button onPress={() => scrollToForm()} variant="primary">
              Quiero reactivos
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-10">
        {isLoading ? (
          <ContentLoading />
        ) : error || !data ? (
          <ContentError />
        ) : items.length === 0 ? (
          <Card className="rounded-3xl" variant="secondary">
            <Card.Header className="gap-2">
              <Card.Title className="text-lg">Vitrina en preparación</Card.Title>
              <Card.Description className="text-(--ink-muted) leading-relaxed">
                Estamos actualizando nuestro catálogo de reactivos. Déjanos tu solicitud y te
                enviaremos la información disponible.
              </Card.Description>
            </Card.Header>
          </Card>
        ) : (
          groups.map(([category, groupItemsList]) => (
            <section className="grid gap-6" key={category}>
              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-(--accent) size-2.5" />
                  <h2 className="font-semibold text-(--ink) text-2xl">{category}</h2>
                </div>
                <Separator />
              </div>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {groupItemsList.map((item) => (
                  <VitrinaCard item={item} key={item.id} />
                ))}
              </div>
            </section>
          ))
        )}
      </section>

      <section className="grid gap-3 scroll-mt-24" id={LEAD_FORM_ID}>
        <LeadForm vitrinaItems={items} />
      </section>
    </PageShell>
  );
}

function scrollToForm() {
  const el = document.getElementById(LEAD_FORM_ID);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export const Route = createFileRoute("/venta-empresas")({
  component: VentaEmpresasPage,
  head: () => {
    const origin = typeof window === "undefined" ? "https://bioalergia.cl" : window.location.origin;
    const url = `${origin}/venta-empresas`;
    return {
      meta: [
        { title: "Venta a empresas · Bioalergia" },
        {
          name: "description",
          content:
            "Reactivos para pruebas cutáneas y extractos alergénicos para empresas, clínicas y laboratorios. Revisa nuestra vitrina y solicita una cotización a tu medida en Concepción.",
        },
        { property: "og:title", content: "Venta a empresas · Bioalergia" },
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
