import {
  addOccCustodyEventInputSchema,
  addOccSampleInputSchema,
  createOccOrderInputSchema,
  createOccSubjectInputSchema,
  discloseToEmployerInputSchema,
  linkSubjectIdentityInputSchema,
  listOccOrdersInputSchema,
  occCustodyEventResponseSchema,
  occOkResponseSchema,
  occOrderDetailResponseSchema,
  occOrderIdInputSchema,
  occOrderListResponseSchema,
  occOrderResponseSchema,
  occSampleResponseSchema,
  occSubjectResponseSchema,
  recordConfirmatoryInputSchema,
  recordMedicalReviewInputSchema,
  recordOccConsentInputSchema,
  recordScreeningInputSchema,
  revokeOccConsentInputSchema,
} from "@finanzas/orpc-contracts/occupational-testing";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  addCustodyEvent,
  addSample,
  createOrder,
  createSubject,
  discloseToEmployer,
  getOrderDetail,
  linkSubjectIdentity,
  listOrders,
  recordConfirmatory,
  recordConsent,
  recordMedicalReview,
  recordScreening,
  revokeConsent,
  serializeOrder,
  serializeSubject,
} from "../services/occupational-testing.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type OccTestingORPCContext = { hono: HonoContext };
const base = os.$context<OccTestingORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// Tier PHI clínico: resultado individual = dato sensible de salud. Se reusa el
// subject `ImmunotherapyAdministration` (staff clínico) para no seedear un
// subject nuevo en prod; el empleador NO tiene acceso a estos endpoints.
function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "ImmunotherapyAdministration");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const reader = requirePermission("read");
const writer = requirePermission("update");

function serializeSampleRow(s: {
  id: number;
  orderId: number;
  kind: "MUESTRA" | "CONTRAMUESTRA";
  containerCode: string;
  matrix: "ORINA" | "SANGRE" | "SALIVA" | "ALIENTO";
  sealId: string | null;
  sealIntact: boolean;
  primaryAliquotOf: number | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    orderId: s.orderId,
    kind: s.kind,
    containerCode: s.containerCode,
    matrix: s.matrix,
    sealId: s.sealId,
    sealIntact: s.sealIntact,
    primaryAliquotOf: s.primaryAliquotOf,
    createdAt: s.createdAt,
  };
}

function serializeCustodyRow(e: {
  id: number;
  orderId: number;
  sampleId: number | null;
  action:
    | "COLLECT"
    | "SPLIT"
    | "SEAL"
    | "DONOR_VERIFY"
    | "HANDOFF"
    | "TRANSPORT"
    | "RECEIVE"
    | "SEAL_CHECK"
    | "ALIQUOT"
    | "STORE"
    | "DESTROY";
  actorRole: string | null;
  signatureRef: string | null;
  sealIntact: boolean | null;
  location: string | null;
  notes: string | null;
  occurredAt: Date;
}) {
  return {
    id: e.id,
    orderId: e.orderId,
    sampleId: e.sampleId,
    action: e.action,
    actorRole: e.actorRole,
    signatureRef: e.signatureRef,
    sealIntact: e.sealIntact,
    location: e.location,
    notes: e.notes,
    occurredAt: e.occurredAt,
  };
}

const occupationalTestingRouterBase = {
  createSubject: writer
    .route({ method: "POST", path: "/subjects", tags: ["OccTesting"] })
    .input(createOccSubjectInputSchema)
    .output(occSubjectResponseSchema)
    .handler(async ({ input }) => {
      const subject = await createSubject(input);
      return { subject: serializeSubject(subject) };
    }),

  linkSubjectIdentity: writer
    .route({ method: "POST", path: "/subjects/link-identity", tags: ["OccTesting"] })
    .input(linkSubjectIdentityInputSchema)
    .output(occSubjectResponseSchema)
    .handler(async ({ input }) => {
      const subject = await linkSubjectIdentity(input.subjectId, input.personId);
      return { subject: serializeSubject(subject) };
    }),

  createOrder: writer
    .route({ method: "POST", path: "/orders", tags: ["OccTesting"] })
    .input(createOccOrderInputSchema)
    .output(occOrderResponseSchema)
    .handler(async ({ input, context }) => {
      const order = await createOrder(input, context.user.id ?? null);
      return { order: serializeOrder(order) };
    }),

  listOrders: reader
    .route({ method: "POST", path: "/orders/list", tags: ["OccTesting"] })
    .input(listOccOrdersInputSchema)
    .output(occOrderListResponseSchema)
    .handler(async ({ input }) => {
      const orders = await listOrders(input.programId);
      return { orders: orders.map((o) => serializeOrder(o)) };
    }),

  getOrder: reader
    .route({ method: "POST", path: "/orders/detail", tags: ["OccTesting"] })
    .input(occOrderIdInputSchema)
    .output(occOrderDetailResponseSchema)
    .handler(async ({ input }) => {
      const o = await getOrderDetail(input.orderId);
      return {
        order: serializeOrder(o),
        subject: serializeSubject(o.subject),
        samples: o.samples.map(serializeSampleRow),
        custodyEvents: o.custodyEvents.map(serializeCustodyRow),
      };
    }),

  addSample: writer
    .route({ method: "POST", path: "/samples", tags: ["OccTesting"] })
    .input(addOccSampleInputSchema)
    .output(occSampleResponseSchema)
    .handler(async ({ input }) => {
      const sample = await addSample(input);
      return { sample: serializeSampleRow(sample) };
    }),

  addCustodyEvent: writer
    .route({ method: "POST", path: "/custody", tags: ["OccTesting"] })
    .input(addOccCustodyEventInputSchema)
    .output(occCustodyEventResponseSchema)
    .handler(async ({ input, context }) => {
      const event = await addCustodyEvent(input, context.user.id ?? null);
      return { event: serializeCustodyRow(event) };
    }),

  recordScreening: writer
    .route({ method: "POST", path: "/screening", tags: ["OccTesting"] })
    .input(recordScreeningInputSchema)
    .output(occOrderResponseSchema)
    .handler(async ({ input }) => {
      await recordScreening(input);
      const o = await getOrderDetail(input.orderId);
      return { order: serializeOrder(o) };
    }),

  recordConfirmatory: writer
    .route({ method: "POST", path: "/confirmatory", tags: ["OccTesting"] })
    .input(recordConfirmatoryInputSchema)
    .output(occOrderResponseSchema)
    .handler(async ({ input }) => {
      await recordConfirmatory(input);
      const o = await getOrderDetail(input.orderId);
      return { order: serializeOrder(o) };
    }),

  recordMedicalReview: writer
    .route({ method: "POST", path: "/medical-review", tags: ["OccTesting"] })
    .input(recordMedicalReviewInputSchema)
    .output(occOrderResponseSchema)
    .handler(async ({ input, context }) => {
      await recordMedicalReview(input, context.user.id ?? null);
      const o = await getOrderDetail(input.orderId);
      return { order: serializeOrder(o) };
    }),

  recordConsent: writer
    .route({ method: "POST", path: "/consents", tags: ["OccTesting"] })
    .input(recordOccConsentInputSchema)
    .output(occOkResponseSchema)
    .handler(async ({ input }) => {
      await recordConsent(input);
      return { ok: true as const };
    }),

  revokeConsent: writer
    .route({ method: "POST", path: "/consents/revoke", tags: ["OccTesting"] })
    .input(revokeOccConsentInputSchema)
    .output(occOkResponseSchema)
    .handler(async ({ input }) => {
      await revokeConsent(input.consentId);
      return { ok: true as const };
    }),

  discloseToEmployer: writer
    .route({ method: "POST", path: "/disclose", tags: ["OccTesting"] })
    .input(discloseToEmployerInputSchema)
    .output(occOkResponseSchema)
    .handler(async ({ input, context }) => {
      await discloseToEmployer(input, context.user.id ?? null);
      return { ok: true as const };
    }),
};

export const occupationalTestingORPCRouter = base
  .prefix("/api/orpc/occupational-testing")
  .router(occupationalTestingRouterBase);

export const occupationalTestingORPCHandler = new SuperJSONRPCHandler(
  occupationalTestingORPCRouter,
  {
    interceptors: [
      onError((error) => {
        logError(error, { module: "api", operation: "orpc.occupational-testing" });
      }),
    ],
  }
);

export const occupationalTestingOpenAPIHandler = new OpenAPIHandler(occupationalTestingORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Salud Ocupacional — Testeo Individual oRPC",
          description: "Resultado individual stage-C (compliance-by-design; staff clínico).",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.occupational-testing" });
    }),
  ],
});

export type OccupationalTestingORPCRouter = typeof occupationalTestingORPCRouter;
