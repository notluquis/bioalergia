import {
  bookEntriesResponseSchema,
  complaintSchema,
  complaintsResponseSchema,
  createBookEntryInputSchema,
  createComplaintInputSchema,
  foliatedBookEntrySchema,
  listBookEntriesInputSchema,
  listComplaintsInputSchema,
  resolveComplaintInputSchema,
} from "@finanzas/orpc-contracts/complaints";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createBookEntry,
  createComplaint,
  listBookEntries,
  listComplaints,
  resolveComplaint,
} from "../services/complaints.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ComplaintsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ComplaintsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readComplaints = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Setting");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const updateComplaints = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Setting");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const complaintsORPCRouterBase = {
  // ── Reclamos / sugerencias (Decreto 35) ─────────────────────────────
  listComplaints: readComplaints
    .route({ method: "GET", path: "/complaints" })
    .input(listComplaintsInputSchema)
    .output(complaintsResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof listComplaintsInputSchema> }) =>
      listComplaints(input)
    ),

  createComplaint: updateComplaints
    .route({ method: "POST", path: "/complaints" })
    .input(createComplaintInputSchema)
    .output(complaintSchema)
    .handler(async ({ input }: { input: z.infer<typeof createComplaintInputSchema> }) =>
      createComplaint(input)
    ),

  resolveComplaint: updateComplaints
    .route({ method: "POST", path: "/complaints/resolve" })
    .input(resolveComplaintInputSchema)
    .output(complaintSchema)
    .handler(async ({ input }: { input: z.infer<typeof resolveComplaintInputSchema> }) =>
      resolveComplaint(input)
    ),

  // ── Libros foliados electrónicos ────────────────────────────────────
  listBookEntries: readComplaints
    .route({ method: "GET", path: "/book" })
    .input(listBookEntriesInputSchema)
    .output(bookEntriesResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof listBookEntriesInputSchema> }) =>
      listBookEntries(input)
    ),

  createBookEntry: updateComplaints
    .route({ method: "POST", path: "/book" })
    .input(createBookEntryInputSchema)
    .output(foliatedBookEntrySchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.infer<typeof createBookEntryInputSchema>;
        context: ComplaintsORPCContext & { user: { id: number } };
      }) => createBookEntry(input, context.user.id)
    ),
};

export const complaintsORPCRouter = base
  .prefix("/api/orpc/complaints")
  .router(complaintsORPCRouterBase);

export const complaintsORPCHandler = new SuperJSONRPCHandler(complaintsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.complaints",
      });
    }),
  ],
});

export type ComplaintsORPCRouter = typeof complaintsORPCRouter;
