import { addressSchema } from "@finanzas/orpc-contracts/addresses";
import { personSchema } from "@finanzas/orpc-contracts/patients";
import { socialAccountSchema, socialPostSchema } from "@finanzas/orpc-contracts/social";
import { http, HttpResponse } from "msw";
import type { z } from "zod";

/**
 * MSW handlers for Storybook + addon-vitest.
 *
 * Stories that exercise components which call oRPC (lists, wizards,
 * inbox panes) need a network mock — otherwise vitest browser tests
 * crash on the first `fetch('/api/orpc/…')` because nothing answers
 * and `csrfFetch` rejects.
 *
 * Three principles:
 *   1. **Never hit the real DB.** Every handler returns deterministic
 *      fixtures or a generic 200 success. No external network calls.
 *   2. **Destructive verbs return success without state change.**
 *      Buttons labeled "Eliminar", "Borrar", "Cancelar" can be clicked
 *      in stories with no DB risk because the underlying mutation
 *      resolves to a fake success here.
 *   3. **Match oRPC's wire shape.** All oRPC requests are POST to
 *      `/api/orpc/<namespace>/rpc/<procedure>`. The response body is
 *      the contract's output schema, serialized via SuperJSON.
 *
 * Extend with feature-specific fixtures inline next to the story:
 *   parameters: { msw: { handlers: [...defaults, http.post(...)] } }
 */

const ok = (data: unknown = { ok: true }) => HttpResponse.json({ json: data, meta: [] });

/**
 * Anchor fixtures to the real oRPC Zod contracts. If a contract output schema
 * changes, this throws at module load so every story/browser-test fails LOUDLY
 * instead of silently passing against a stale hand-typed shape (the classic
 * MSW false-green). Validates the reused leaf entities (person, address).
 */
function assertFixture<S extends z.ZodType>(schema: S, value: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `[msw-handlers] fixture "${label}" drifted from its oRPC contract:\n${result.error.message}`
    );
  }
  return result.data;
}

const SAMPLE_ADDRESS = {
  id: 1,
  personId: 1,
  label: "Principal",
  street: "Av. Apoquindo",
  number: "5000",
  supplement: "Of. 802",
  reference: null,
  postalCode: "7560864",
  comuna: "Las Condes",
  region: "Metropolitana",
  coverageCode: "LCON",
  regionCode: "RM",
  ineRegionCode: 13,
  ineCountyCode: 13114,
  supportsCashOnDelivery: true,
  supportsReturn: true,
  latitude: -33.4174,
  longitude: -70.6041,
  chilexpressAddressId: null,
  countryCode: "CL",
  isPrimary: true,
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const SAMPLE_PERSON = {
  id: 1,
  rut: "12345678-9",
  names: "María José",
  fatherName: "Pérez",
  motherName: "González",
  email: "demo@bioalergia.cl",
  phone: "+56912345678",
  personType: "NATURAL",
  createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

const SAMPLE_PATIENT = {
  id: 1,
  person: SAMPLE_PERSON,
};

// Contract-anchored: throws at load if the schemas drift from these fixtures.
assertFixture(addressSchema, SAMPLE_ADDRESS, "SAMPLE_ADDRESS");
assertFixture(personSchema, SAMPLE_PERSON, "SAMPLE_PERSON");

// ── Social media approval panel ──────────────────────────────────────────
// Posts across the status lifecycle: a DRAFT with rendered media awaiting
// approval, a SCHEDULED post queued to publish, and a PUBLISHED post whose
// targets carry live permalinks. Validated against socialPostSchema at load.
const ISO = (s: string) => new Date(s).toISOString();

const SAMPLE_SOCIAL_POST_DRAFT = {
  id: 101,
  title: "Promo invierno — alergias",
  status: "DRAFT",
  mediaType: "IMAGE",
  aspectRatio: "RATIO_4_5",
  caption:
    "¿Estornudos sin parar este invierno? Agenda tu test de alergias y arma tu plan de inmunoterapia con nuestro equipo.",
  hashtags: ["alergia", "inmunoterapia", "salud"],
  media: [
    {
      key: "renders/post-101/cover.png",
      url: "https://picsum.photos/seed/social101/600/750",
      type: "image",
      width: 1080,
      height: 1350,
    },
  ],
  scheduledAt: null,
  approvedByUserId: null,
  approvedAt: null,
  rejectedReason: null,
  createdByUserId: 1,
  publishedAt: null,
  errorMessage: null,
  createdAt: ISO("2026-06-10T12:00:00Z"),
  updatedAt: ISO("2026-06-10T12:00:00Z"),
  targets: [
    {
      id: 9001,
      postId: 101,
      accountId: 1,
      network: "INSTAGRAM",
      placement: "IG_FEED",
      status: "PENDING",
      externalId: null,
      permalink: null,
      errorMessage: null,
      attempts: 0,
      createdAt: ISO("2026-06-10T12:00:00Z"),
      updatedAt: ISO("2026-06-10T12:00:00Z"),
    },
    {
      id: 9002,
      postId: 101,
      accountId: 1,
      network: "FACEBOOK",
      placement: "FB_FEED",
      status: "PENDING",
      externalId: null,
      permalink: null,
      errorMessage: null,
      attempts: 0,
      createdAt: ISO("2026-06-10T12:00:00Z"),
      updatedAt: ISO("2026-06-10T12:00:00Z"),
    },
  ],
};

const SAMPLE_SOCIAL_POST_SCHEDULED = {
  id: 102,
  title: "Día Mundial de la Alergia",
  status: "SCHEDULED",
  mediaType: "VIDEO",
  aspectRatio: "RATIO_9_16",
  caption: "Mañana es el Día Mundial de la Alergia. Te contamos los mitos más comunes.",
  hashtags: ["diamundialdelaalergia", "bioalergia"],
  media: [
    {
      key: "renders/post-102/reel.png",
      url: "https://picsum.photos/seed/social102/600/1066",
      type: "image",
      width: 1080,
      height: 1920,
    },
  ],
  scheduledAt: ISO("2026-06-30T17:00:00Z"),
  approvedByUserId: 1,
  approvedAt: ISO("2026-06-11T09:00:00Z"),
  rejectedReason: null,
  createdByUserId: 1,
  publishedAt: null,
  errorMessage: null,
  createdAt: ISO("2026-06-11T08:00:00Z"),
  updatedAt: ISO("2026-06-11T09:00:00Z"),
  targets: [
    {
      id: 9003,
      postId: 102,
      accountId: 1,
      network: "INSTAGRAM",
      placement: "IG_REEL",
      status: "PENDING",
      externalId: null,
      permalink: null,
      errorMessage: null,
      attempts: 0,
      createdAt: ISO("2026-06-11T08:00:00Z"),
      updatedAt: ISO("2026-06-11T09:00:00Z"),
    },
  ],
};

const SAMPLE_SOCIAL_POST_PUBLISHED = {
  id: 103,
  title: "Testimonios de pacientes",
  status: "PUBLISHED",
  mediaType: "CAROUSEL",
  aspectRatio: "RATIO_1_1",
  caption: "Gracias por confiar en nosotros. Estos son algunos testimonios de nuestros pacientes.",
  hashtags: ["testimonios", "pacientes"],
  media: [
    {
      key: "renders/post-103/slide1.png",
      url: "https://picsum.photos/seed/social103a/600/600",
      type: "image",
      width: 1080,
      height: 1080,
    },
    {
      key: "renders/post-103/slide2.png",
      url: "https://picsum.photos/seed/social103b/600/600",
      type: "image",
      width: 1080,
      height: 1080,
    },
  ],
  scheduledAt: ISO("2026-06-05T15:00:00Z"),
  approvedByUserId: 1,
  approvedAt: ISO("2026-06-04T10:00:00Z"),
  rejectedReason: null,
  createdByUserId: 1,
  publishedAt: ISO("2026-06-05T15:00:30Z"),
  errorMessage: null,
  createdAt: ISO("2026-06-04T09:00:00Z"),
  updatedAt: ISO("2026-06-05T15:00:30Z"),
  targets: [
    {
      id: 9004,
      postId: 103,
      accountId: 1,
      network: "INSTAGRAM",
      placement: "IG_FEED",
      status: "PUBLISHED",
      externalId: "17900000000000000",
      permalink: "https://www.instagram.com/p/Cxample103/",
      errorMessage: null,
      attempts: 1,
      publishedAt: ISO("2026-06-05T15:00:30Z"),
      createdAt: ISO("2026-06-04T09:00:00Z"),
      updatedAt: ISO("2026-06-05T15:00:30Z"),
    },
    {
      id: 9005,
      postId: 103,
      accountId: 1,
      network: "FACEBOOK",
      placement: "FB_FEED",
      status: "PUBLISHED",
      externalId: "12200000000000000",
      permalink: "https://www.facebook.com/bioalergia/posts/103",
      errorMessage: null,
      attempts: 1,
      publishedAt: ISO("2026-06-05T15:00:30Z"),
      createdAt: ISO("2026-06-04T09:00:00Z"),
      updatedAt: ISO("2026-06-05T15:00:30Z"),
    },
  ],
};

const SAMPLE_SOCIAL_ACCOUNT = {
  id: 1,
  provider: "META",
  displayName: "Bioalergia (Meta)",
  metaBusinessId: "100000000000000",
  fbPageId: "200000000000000",
  igUserId: "17800000000000000",
  tokenExpiresAt: ISO("2026-09-01T00:00:00Z"),
  graphApiVersion: "v21.0",
  active: true,
  createdAt: ISO("2026-01-01T00:00:00Z"),
  updatedAt: ISO("2026-06-01T00:00:00Z"),
};

// Contract-anchored: drift in socialPostSchema / socialAccountSchema throws here.
assertFixture(socialPostSchema, SAMPLE_SOCIAL_POST_DRAFT, "SAMPLE_SOCIAL_POST_DRAFT");
assertFixture(socialPostSchema, SAMPLE_SOCIAL_POST_SCHEDULED, "SAMPLE_SOCIAL_POST_SCHEDULED");
assertFixture(socialPostSchema, SAMPLE_SOCIAL_POST_PUBLISHED, "SAMPLE_SOCIAL_POST_PUBLISHED");
assertFixture(socialAccountSchema, SAMPLE_SOCIAL_ACCOUNT, "SAMPLE_SOCIAL_ACCOUNT");

export const SOCIAL_FIXTURES = {
  draft: SAMPLE_SOCIAL_POST_DRAFT,
  scheduled: SAMPLE_SOCIAL_POST_SCHEDULED,
  published: SAMPLE_SOCIAL_POST_PUBLISHED,
  account: SAMPLE_SOCIAL_ACCOUNT,
  allPosts: [SAMPLE_SOCIAL_POST_DRAFT, SAMPLE_SOCIAL_POST_SCHEDULED, SAMPLE_SOCIAL_POST_PUBLISHED],
};

/** Social handlers: list/detail/listAccounts return fixtures; mutations succeed. */
export const socialHandlers = [
  http.post("*/api/orpc/social/rpc/list", () => ok({ posts: SOCIAL_FIXTURES.allPosts })),
  http.post("*/api/orpc/social/rpc/detail", () =>
    ok({ post: SAMPLE_SOCIAL_POST_DRAFT, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/listAccounts", () => ok({ accounts: [SAMPLE_SOCIAL_ACCOUNT] })),
  http.post("*/api/orpc/social/rpc/getSettings", () => ok({ settings: { dryRun: true } })),
  http.post("*/api/orpc/social/rpc/updateSettings", () => ok({ settings: { dryRun: false } })),
  http.post("*/api/orpc/social/rpc/create", () =>
    ok({ post: SAMPLE_SOCIAL_POST_DRAFT, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/update", () =>
    ok({ post: SAMPLE_SOCIAL_POST_DRAFT, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/render", () =>
    ok({ post: SAMPLE_SOCIAL_POST_DRAFT, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/approve", () =>
    ok({ post: { ...SAMPLE_SOCIAL_POST_DRAFT, status: "PENDING_APPROVAL" }, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/reject", () =>
    ok({ post: { ...SAMPLE_SOCIAL_POST_DRAFT, status: "FAILED" }, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/schedule", () =>
    ok({ post: SAMPLE_SOCIAL_POST_SCHEDULED, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/publishNow", () =>
    ok({ post: { ...SAMPLE_SOCIAL_POST_SCHEDULED, status: "PUBLISHING" }, status: "ok" })
  ),
  http.post("*/api/orpc/social/rpc/connectAccount", () =>
    ok({ account: SAMPLE_SOCIAL_ACCOUNT, status: "ok" })
  ),
];

export const handlers = [
  // CSRF token — every csrfFetch fetches this first.
  http.get("*/api/csrf", () => HttpResponse.json({ token: "msw-fake-csrf" })),

  // Auth session probe.
  http.post("*/api/orpc/auth/rpc/session", () => ok({ user: SAMPLE_PATIENT.person })),

  // Addresses.
  http.post("*/api/orpc/addresses/rpc/list", () => ok({ addresses: [SAMPLE_ADDRESS] })),
  http.post("*/api/orpc/addresses/rpc/create", () => ok({ address: SAMPLE_ADDRESS })),
  http.post("*/api/orpc/addresses/rpc/update", () => ok({ address: SAMPLE_ADDRESS })),
  http.post("*/api/orpc/addresses/rpc/delete", () => ok({ ok: true })),

  // Patients.
  http.post("*/api/orpc/patients/rpc/detail", () => ok({ patient: SAMPLE_PATIENT })),
  http.post("*/api/orpc/patients/rpc/list", () => ok({ patients: [SAMPLE_PATIENT], total: 1 })),

  // Shipments (Chilexpress regions/communes/offices — small fixtures).
  http.post("*/api/orpc/shipments/rpc/regions", () =>
    ok({ regions: [{ regionId: "RM", regionName: "METROPOLITANA DE SANTIAGO" }] })
  ),
  http.post("*/api/orpc/shipments/rpc/communes", () =>
    ok({
      communes: [
        {
          countyName: "Las Condes",
          coverageRegionCode: "LCON",
          supportsCashOnDelivery: true,
        },
      ],
    })
  ),
  http.post("*/api/orpc/shipments/rpc/list", () => ok({ shipments: [] })),

  // Social media approval panel.
  ...socialHandlers,

  // Catchall: every other oRPC endpoint resolves to a generic success.
  // Destructive verbs (delete/cancel/send/broadcast) fall through to here
  // and complete the story interaction without hitting any real backend.
  http.post("*/api/orpc/*", () => ok({})),
  http.get("*/api/orpc/*", () => ok({})),
];
