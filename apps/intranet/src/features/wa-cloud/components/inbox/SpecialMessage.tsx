import { Chip } from "@heroui/react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  ExternalLink,
  FileText,
  Forward,
  Image as ImageIcon,
  Info,
  type LucideIcon,
  Mail,
  MapPin,
  Mic,
  Phone,
  Sticker,
  User,
  Video,
} from "lucide-react";

type Payload = Record<string, unknown> | null | undefined;

const QUOTE_ICON: Record<string, LucideIcon> = {
  IMAGE: ImageIcon,
  VIDEO: Video,
  AUDIO: Mic,
  DOCUMENT: FileText,
  LOCATION: MapPin,
  STICKER: Sticker,
};

// WhatsApp-style quoted reply: a colored left bar, the quoted sender's name in
// an accent color, the type (icon + noun) or text body, and a thumbnail for
// media. The panel uses its OWN opaque tone (not alpha over the bubble) so it
// contrasts on both the green outbound bubble and the content1 inbound one.
export function QuotedReply({
  quoted,
  contactName,
  bubbleOut,
}: {
  quoted: { body: string; out: boolean; type: string; thumbnailMessageId?: number };
  contactName: string;
  bubbleOut: boolean;
}) {
  const sender = quoted.out ? "Tú" : contactName;
  const Icon = QUOTE_ICON[quoted.type];
  const isText = quoted.type === "TEXT";
  const panel = bubbleOut
    ? "border-l-success-200 bg-success-700/90"
    : "border-l-accent bg-default-100";
  const nameColor = bubbleOut ? "text-success-100" : "text-accent";
  const bodyColor = bubbleOut ? "text-success-50/90" : "text-default-600";
  return (
    <div className={`mb-1 flex items-center gap-2 rounded border-l-4 px-2 py-1 ${panel}`}>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-xs ${nameColor}`}>{sender}</p>
        <p className={`flex items-center gap-1 text-xs ${bodyColor}`}>
          {!isText && Icon && <Icon size={12} className="shrink-0" />}
          <span className="truncate">{quoted.body}</span>
        </p>
      </div>
      {quoted.thumbnailMessageId && (
        <img
          src={`/api/wa-cloud/media/${quoted.thumbnailMessageId}`}
          alt=""
          loading="lazy"
          className="size-10 shrink-0 rounded object-cover ring-1 ring-black/10"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

export function ForwardedBadge({ payload }: { payload: Payload }) {
  const ctx = (payload as { context?: { forwarded?: boolean } } | null)?.context;
  if (!ctx?.forwarded) return null;
  return (
    <Chip size="sm" variant="soft" color="default" className="mb-1">
      <Forward size={11} />
      <Chip.Label>Reenviado</Chip.Label>
    </Chip>
  );
}

// Static mini-map for a location. Slippy-map math (no dep) picks the tile + pin
// offset; the tile is served by OUR backend proxy (cached in R2), NOT fetched
// from OpenStreetMap by the operator's browser — so the patient's shared
// location (PHI) never leaks to a third party. Square container = tile renders
// 1:1 so the pin lands exactly on the point.
function LocationMap({ lat, lng }: { lat: number; lng: number }) {
  const z = 15;
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  const xF = ((lng + 180) / 360) * n;
  const yF = ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(xF);
  const y = Math.floor(yF);
  const pinLeft = (xF - x) * 100;
  const pinTop = (yF - y) * 100;
  const tile = `/api/wa-cloud/media/map-tile/${z}/${x}/${y}`;
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-default-100">
      <img
        src={tile}
        alt=""
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      <span
        className="-translate-x-1/2 -translate-y-full pointer-events-none absolute"
        style={{ left: `${pinLeft}%`, top: `${pinTop}%` }}
      >
        <MapPin size={28} className="fill-danger text-danger-foreground drop-shadow-md" />
      </span>
      <span className="absolute right-0.5 bottom-0.5 rounded bg-black/45 px-1 text-[9px] text-white/90">
        © OpenStreetMap
      </span>
    </div>
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
      className="block w-60 max-w-full overflow-hidden rounded-xl border border-default-200 bg-content1 transition hover:bg-content2"
    >
      <LocationMap lat={latitude} lng={longitude} />
      <div className="flex items-start gap-2 p-2.5">
        <MapPin size={16} className="mt-0.5 shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{name ?? "Ubicación compartida"}</p>
          {address && <p className="mt-0.5 line-clamp-2 text-default-500 text-xs">{address}</p>}
          <p className="mt-1 inline-flex items-center gap-0.5 text-accent text-xs">
            Abrir en Maps <ExternalLink size={10} />
          </p>
        </div>
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
          <div key={i} className="rounded-xl border border-default-200 bg-content1 p-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
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
          <ClipboardList size={11} />
          <Chip.Label>Respuesta de formulario</Chip.Label>
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
          <ClipboardList size={11} />
          <Chip.Label>Formulario enviado</Chip.Label>
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

  // Meta's error title is English + usually generic ("Message type unknown").
  // Golden (Chatwoot): neutral, not a warning — the agent can't fix this, and
  // it isn't dangerous. Only surface Meta's title when genuinely informative.
  const errTitle = p?.errors?.[0]?.title;
  const isGeneric = !errTitle || /unknown|unsupported|not supported|message type/i.test(errTitle);
  return (
    <div className="flex w-64 max-w-full items-center gap-2 rounded-lg bg-content2 px-3 py-2">
      <Info size={16} className="shrink-0 text-default-400" />
      <div className="min-w-0">
        <p className="font-medium text-sm">Mensaje no compatible</p>
        <p className="text-default-500 text-xs">
          {isGeneric ? "Puedes verlo en la app de WhatsApp" : errTitle}
        </p>
      </div>
    </div>
  );
}
