import { Chip } from "@heroui/react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  User,
} from "lucide-react";

type Payload = Record<string, unknown> | null | undefined;

export function ForwardedBadge({ payload }: { payload: Payload }) {
  const ctx = (payload as { context?: { forwarded?: boolean } } | null)?.context;
  if (!ctx?.forwarded) return null;
  return (
    <Chip size="sm" variant="soft" color="default" className="mb-1">
      <Chip.Label>↪ Reenviado</Chip.Label>
    </Chip>
  );
}

export function LocationBubble({ payload }: { payload: Payload }) {
  const loc = (
    payload as {
      location?: { latitude: number; longitude: number; name?: string; address?: string };
    } | null
  )?.location;
  if (!loc) return <p className="text-sm">[ubicación]</p>;
  const { latitude, longitude, name, address } = loc;
  const gmapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  return (
    <a
      href={gmapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-72 max-w-full items-start gap-3 rounded-lg bg-content2 p-3 transition hover:bg-content3"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700">
        <MapPin size={24} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{name ?? "Ubicación compartida"}</p>
        {address && <p className="mt-0.5 line-clamp-2 text-default-500 text-xs">{address}</p>}
        <p className="mt-1 font-mono text-default-400 text-xs">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
        <p className="mt-1 inline-flex items-center gap-0.5 text-accent text-xs">
          Abrir en Maps <ExternalLink size={10} />
        </p>
      </div>
    </a>
  );
}

type ContactPayload = {
  name?: { formatted_name?: string; first_name?: string };
  phones?: { phone: string; type?: string; wa_id?: string }[];
  emails?: { email: string; type?: string }[];
};

export function ContactsBubble({ payload }: { payload: Payload }) {
  const contacts = (payload as { contacts?: ContactPayload[] } | null)?.contacts;
  if (!contacts || contacts.length === 0) return <p className="text-sm">[contactos]</p>;
  return (
    <div className="w-72 max-w-full space-y-2">
      {contacts.map((c, i) => {
        const name = c.name?.formatted_name ?? c.name?.first_name ?? "Contacto";
        return (
          <div key={i} className="rounded-lg border border-default-200 bg-content2 p-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-200 text-accent-900">
                <User size={16} />
              </div>
              <p className="min-w-0 flex-1 truncate font-medium text-sm">{name}</p>
            </div>
            <div className="mt-2 space-y-1">
              {c.phones?.map((p, pi) => (
                <a
                  key={pi}
                  href={`tel:${p.phone}`}
                  className="flex items-center gap-1.5 text-default-700 text-xs hover:text-accent"
                >
                  <Phone size={11} className="shrink-0" />
                  <span className="truncate">{p.phone}</span>
                  {p.type && <span className="shrink-0 text-default-400">· {p.type}</span>}
                </a>
              ))}
              {c.emails?.map((e, ei) => (
                <a
                  key={ei}
                  href={`mailto:${e.email}`}
                  className="flex items-center gap-1.5 text-default-700 text-xs hover:text-accent"
                >
                  <Mail size={11} className="shrink-0" />
                  <span className="truncate">{e.email}</span>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function InteractiveBubble({ payload, body }: { payload: Payload; body: string | null }) {
  const it = (
    payload as {
      interactive?: { type?: string; nfm_reply?: { name?: string; response_json?: string } };
    } | null
  )?.interactive;
  // Inbound flow response (nfm_reply)
  if (it?.type === "nfm_reply" && it.nfm_reply) {
    let parsed: Record<string, unknown> = {};
    try {
      const raw: unknown = JSON.parse(it.nfm_reply.response_json ?? "{}");
      if (raw && typeof raw === "object") parsed = raw as Record<string, unknown>;
    } catch {
      // ignore
    }
    return (
      <div className="space-y-1">
        <Chip size="sm" variant="soft" color="success">
          <Chip.Label>📋 Respuesta de formulario</Chip.Label>
        </Chip>
        <div className="space-y-0.5">
          {Object.entries(parsed).map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="font-medium">{k}:</span>{" "}
              <span className="text-default-700">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // Outbound flow placeholder
  const flowMeta = payload as {
    interactive_type?: string;
    flow_cta?: string;
    flow_id?: string;
  } | null;
  if (flowMeta?.interactive_type === "flow") {
    return (
      <div className="space-y-1">
        <Chip size="sm" variant="soft" color="accent">
          <Chip.Label>📋 Formulario enviado</Chip.Label>
        </Chip>
        <p className="text-sm">{body}</p>
        <p className="text-default-500 text-xs">CTA: {flowMeta.flow_cta}</p>
      </div>
    );
  }
  return <p className="text-sm">{body ?? "[interactivo]"}</p>;
}

type UnsupportedShape = {
  type?: string;
  errors?: { code?: number; title?: string; message?: string }[];
  poll?: unknown;
  event?: unknown;
  interactive?: { type?: string };
};

export function UnsupportedBubble({ payload }: { payload: Payload }) {
  const p = payload as UnsupportedShape | null;
  const rawType = p?.type ?? "unknown";

  // Poll detection (Meta sends polls as unsupported with hint in errors or raw type)
  const isPoll =
    rawType === "poll" ||
    Boolean(p?.poll) ||
    p?.interactive?.type === "poll" ||
    p?.errors?.some((e) => /poll/i.test(e.title ?? "") || /poll/i.test(e.message ?? ""));

  // Event detection (calendar invites, WhatsApp events)
  const isEvent =
    rawType === "event" ||
    Boolean(p?.event) ||
    p?.interactive?.type === "event" ||
    p?.errors?.some((e) => /event/i.test(e.title ?? ""));

  if (isPoll) {
    return (
      <div className="flex w-64 max-w-full items-center gap-2">
        <BarChart3 size={18} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-medium text-sm">Encuesta</p>
          <p className="text-default-500 text-xs">Vista no disponible vía Cloud API</p>
        </div>
      </div>
    );
  }

  if (isEvent) {
    return (
      <div className="flex w-64 max-w-full items-center gap-2">
        <CalendarDays size={18} className="shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="font-medium text-sm">Evento de WhatsApp</p>
          <p className="text-default-500 text-xs">Vista no disponible vía Cloud API</p>
        </div>
      </div>
    );
  }

  const errTitle = p?.errors?.[0]?.title;
  return (
    <div className="flex w-64 max-w-full items-center gap-2">
      <AlertTriangle size={18} className="shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="font-medium text-sm">Mensaje no soportado</p>
        <p className="text-default-500 text-xs">{errTitle ?? `Tipo "${rawType}"`}</p>
      </div>
    </div>
  );
}
