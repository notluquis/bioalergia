import {
  createKarinReportInputSchema,
  createKarinReportResponseSchema,
  karinReportSchema,
  karinReportsResponseSchema,
  listKarinReportsInputSchema,
  resolveKarinReportInputSchema,
} from "@finanzas/orpc-contracts/karin";
import { ORPCError, onError, os } from "@orpc/server";
import type { Context as HonoContext } from "hono";
import type { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { createKarinReport, listKarinReports, resolveKarinReport } from "../services/karin.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type KarinORPCContext = {
  hono: HonoContext;
};

const base = os.$context<KarinORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

// El canal Karin es de acceso MÁS restringido que el resto de cumplimiento:
// subject CASL dedicado `KarinReport` (sólo el receptor designado / admin).
function requirePermission(action: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, "KarinReport");
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readKarin = requirePermission("read");
const updateKarin = requirePermission("update");

const karinORPCRouterBase = {
  // Público (sin auth): denuncia del Anexo A desde el sitio o la intranet.
  createReport: base
    .route({ method: "POST", path: "/reports" })
    .input(createKarinReportInputSchema)
    .output(createKarinReportResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof createKarinReportInputSchema> }) =>
      createKarinReport(input)
    ),

  // Staff (subject KarinReport).
  listReports: readKarin
    .route({ method: "GET", path: "/reports" })
    .input(listKarinReportsInputSchema)
    .output(karinReportsResponseSchema)
    .handler(async ({ input }: { input: z.infer<typeof listKarinReportsInputSchema> }) =>
      listKarinReports(input)
    ),

  resolveReport: updateKarin
    .route({ method: "POST", path: "/reports/resolve" })
    .input(resolveKarinReportInputSchema)
    .output(karinReportSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.infer<typeof resolveKarinReportInputSchema>;
        context: KarinORPCContext & { user: { id: number } };
      }) => resolveKarinReport(input, context.user.id)
    ),
};

export const karinORPCRouter = base.prefix("/api/orpc/karin").router(karinORPCRouterBase);

export const karinORPCHandler = new SuperJSONRPCHandler(karinORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.karin" });
    }),
  ],
});

export type KarinORPCRouter = typeof karinORPCRouter;
