import type { Page, Route } from "@playwright/test";
import superjson from "superjson";

/**
 * Deterministic oRPC mocks for the NON-shop public surfaces:
 *   - verification (public document verification — /verificar/$code)
 *   - checkout.status (order confirmation — /pedido/$number)
 *   - site-auth.me (session probe behind /mi-cuenta)
 *
 * Same wire contract as _shop-mocks.ts: the site posts SAME-ORIGIN to
 * `/api/orpc/<ns>/rpc/<proc>` and speaks SuperJSON — the response body is
 * `superjson.serialize(data)` → `{ json, meta }`. We build plain JS fixtures
 * (real `Date` objects where a contract field is a date) and let
 * `superjson.serialize` emit the correct envelope so dates survive the client's
 * `superjson.deserialize` round-trip.
 *
 * Unlike the shop mocks, these route on BOTH the namespace and the procedure
 * (the `/api/orpc/<ns>/rpc/<proc>` path) so a per-test config can decide, e.g.,
 * whether `verification.verify` returns a valid or invalid document, or whether
 * `site-auth.me` reports an authenticated user or an anonymous session.
 *
 * Fixtures mirror the Zod output schemas in:
 *   - packages/orpc-contracts/src/verification.ts (verifyDocumentResponseSchema)
 *   - packages/orpc-contracts/src/checkout.ts      (checkoutStatusResponseSchema)
 *   - packages/orpc-contracts/src/site-auth.ts     (siteAuthSessionResponseSchema)
 */

const ISSUED_AT = new Date("2026-01-15T13:00:00.000Z");

// ---------------------------------------------------------------------------
// Verification fixtures (verifyDocumentResponseSchema — discriminated union)
// ---------------------------------------------------------------------------

export type VerifiedDocument = {
  valid: true;
  documentType: "prescription" | "certificate";
  documentLabel: string;
  issuedAt: Date;
  doctor: { name: string; specialty: string; license?: string };
  patientInitials: string;
  patientRutMasked?: string;
  prescriptionType?: string;
  folio?: string;
  pdfIntact?: boolean;
};

export const VALID_PRESCRIPTION: VerifiedDocument = {
  valid: true,
  documentType: "prescription",
  documentLabel: "Receta médica",
  issuedAt: ISSUED_AT,
  doctor: {
    name: "Dra. Camila Rivas",
    specialty: "Inmunología clínica",
    license: "123456",
  },
  patientInitials: "J. P.",
  patientRutMasked: "12.***.***-9",
  prescriptionType: "Inmunoterapia",
  folio: "BA-2026-0042",
  pdfIntact: true,
};

const INVALID_DOCUMENT = { valid: false as const };

// ---------------------------------------------------------------------------
// Checkout status fixture (checkoutStatusResponseSchema)
// ---------------------------------------------------------------------------

export type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";

export function paidOrder(orderNumber: string) {
  return {
    status: "ok" as const,
    data: {
      order_number: orderNumber,
      status: "PAID" as OrderStatus,
      total_clp: 23980,
      dte_folio: "10042",
      dte_type: "BOLETA",
    },
  };
}

// ---------------------------------------------------------------------------
// site-auth.me fixtures (siteAuthSessionResponseSchema)
// ---------------------------------------------------------------------------

const ANON_SESSION = { status: "ok" as const, user: null };

export function authedSession() {
  return {
    status: "ok" as const,
    user: {
      id: 1,
      email: "cliente@bioalergia.cl",
      name: "Cliente Demo",
      has_password: true,
      passkey_count: 0,
      mfa_enabled: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Installer
// ---------------------------------------------------------------------------

type AccountMockOptions = {
  /** Document returned by verification.verify; `"invalid"` → not-found state. */
  verification?: VerifiedDocument | "invalid";
  /** Response for checkout.status (order lookup). `"error"` → 404 so the route shows its error state. */
  orderStatus?: ReturnType<typeof paidOrder> | "error";
  /** site-auth.me session. Defaults to anonymous (so /mi-cuenta redirects to /login). */
  session?: "anon" | "authed";
};

async function fulfillSuperjson(route: Route, data: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(superjson.serialize(data)),
  });
}

/**
 * Installs deterministic mocks for the non-shop public oRPC surfaces. Routing is
 * by `<ns>/rpc/<proc>` so each procedure gets its configured fixture; anything
 * unmocked falls back to a generic 200 so no request hangs.
 */
export async function installAccountMocks(
  page: Page,
  opts: AccountMockOptions = {}
): Promise<void> {
  const verification = opts.verification ?? VALID_PRESCRIPTION;
  const orderStatus = opts.orderStatus ?? null;
  const session = opts.session ?? "anon";

  await page.route("**/api/orpc/**", async (route) => {
    const url = new URL(route.request().url());
    // path: /api/orpc/<ns>/rpc/<proc>
    const segments = url.pathname.split("/").filter(Boolean);
    const proc = segments.at(-1) ?? "";
    const ns = segments.at(-3) ?? "";
    const key = `${ns}/${proc}`;

    if (key === "verification/verify") {
      await fulfillSuperjson(route, verification === "invalid" ? INVALID_DOCUMENT : verification);
      return;
    }

    if (key === "checkout/status") {
      if (orderStatus === "error" || orderStatus === null) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ json: { message: "Pedido no encontrado" }, meta: [] }),
        });
        return;
      }
      await fulfillSuperjson(route, orderStatus);
      return;
    }

    if (key === "site-auth/me") {
      await fulfillSuperjson(route, session === "authed" ? authedSession() : ANON_SESSION);
      return;
    }

    // Generic deterministic fallback — keeps unknown procs from hanging.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ json: { ok: true }, meta: [] }),
    });
  });
}
