import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  attendanceAdminMarkInputSchema,
  attendanceDeleteResponseSchema,
  attendanceListInputSchema,
  attendanceListResponseSchema,
  attendanceMarkIdInputSchema,
  attendanceMarkInputSchema,
  attendanceMarkResponseSchema,
  attendanceStatusResponseSchema,
  officeNetworkCreateInputSchema,
  officeNetworkResponseSchema,
  officeNetworkUpdateInputSchema,
  officeNetworksResponseSchema,
} from "@finanzas/orpc-contracts/attendance";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createAdminMark,
  createMark,
  createOfficeNetwork,
  deleteMark,
  deleteOfficeNetwork,
  findEmployeeByUserId,
  getTodayStatus,
  listMarks,
  listOfficeNetworks,
  updateOfficeNetwork,
} from "../services/attendance.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type AttendanceORPCContext = {
  hono: HonoContext;
};

const base = os.$context<AttendanceORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({ context: { ...context, user } });
});

const adminOnly = authed.use(async ({ context, next }) => {
  const canAdmin = await hasPermission(context.user, "read", "AttendanceAdmin");

  if (!canAdmin) {
    throw new ORPCError("FORBIDDEN", { message: "Acceso restringido" });
  }

  return next();
});

/** Extract the real client IP from the Hono request */
function extractIp(c: HonoContext): string | null {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null
  );
}

const attendanceORPCRouterBase = {
  // ── Employee endpoints ────────────────────────────────────────────────────

  /**
   * POST /mark — empleado marca entrada o salida.
   * Detecta automáticamente si el IP es red de oficina.
   */
  mark: authed
    .route({ method: "POST", path: "/mark" })
    .input(attendanceMarkInputSchema)
    .output(attendanceMarkResponseSchema)
    .handler(async ({ input, context }) => {
      const employee = await findEmployeeByUserId(context.user.id);

      if (!employee) {
        throw new ORPCError("FORBIDDEN", {
          message: "No se encontró un empleado asociado a este usuario",
        });
      }

      if (employee.status !== "ACTIVE") {
        throw new ORPCError("FORBIDDEN", {
          message: "El empleado no está activo",
        });
      }

      const ip = extractIp(context.hono);
      const userAgent = context.hono.req.header("user-agent") ?? null;

      const { mark, timesheetSynced } = await createMark(
        {
          employeeId: employee.id,
          type: input.type,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          connectionType: input.connectionType,
          downlinkMbps: input.downlinkMbps,
          isMobile: input.isMobile,
          clientTimezone: input.clientTimezone,
          deviceRam: input.deviceRam,
          cpuCores: input.cpuCores,
          screenResolution: input.screenResolution,
          devicePixelRatio: input.devicePixelRatio,
        },
        { ip, userAgent }
      );

      return { mark, timesheetSynced, status: "ok" as const };
    }),

  /**
   * GET /status — estado actual del empleado autenticado (hoy).
   */
  status: authed
    .route({ method: "GET", path: "/status" })
    .output(attendanceStatusResponseSchema)
    .handler(async ({ context }) => {
      const employee = await findEmployeeByUserId(context.user.id);

      if (!employee) {
        throw new ORPCError("FORBIDDEN", {
          message: "No se encontró un empleado asociado a este usuario",
        });
      }

      const result = await getTodayStatus(employee.id);
      return { ...result, status: "ok" as const };
    }),

  // ── Admin endpoints ───────────────────────────────────────────────────────

  /**
   * GET /list — admin: listar marcas con filtros.
   */
  listMarks: adminOnly
    .route({ method: "GET", path: "/list" })
    .input(attendanceListInputSchema)
    .output(attendanceListResponseSchema)
    .handler(async ({ input }) => {
      const { marks, summary } = await listMarks({
        employeeId: input.employeeId,
        from: input.from,
        to: input.to,
        completionStatus: input.completionStatus,
      });
      return { marks, summary, status: "ok" as const };
    }),

  /**
   * POST /admin-mark — corrección manual por admin.
   */
  adminMark: adminOnly
    .route({ method: "POST", path: "/admin-mark" })
    .input(attendanceAdminMarkInputSchema)
    .output(attendanceMarkResponseSchema)
    .handler(async ({ input, context }) => {
      const { mark, timesheetSynced } = await createAdminMark(
        input.employeeId,
        input.type,
        new Date(input.markedAt),
        context.user.id,
        input.notes
      );
      return { mark, timesheetSynced, status: "ok" as const };
    }),

  /**
   * DELETE /mark/{id} — eliminar marca errónea (admin).
   */
  deleteMark: adminOnly
    .route({ method: "DELETE", path: "/mark/{id}" })
    .input(attendanceMarkIdInputSchema)
    .output(attendanceDeleteResponseSchema)
    .handler(async ({ input }) => {
      await deleteMark(input.id);
      return { status: "ok" as const };
    }),

  // ── Office Networks ───────────────────────────────────────────────────────

  listOfficeNetworks: authed
    .route({ method: "GET", path: "/office-networks" })
    .output(officeNetworksResponseSchema)
    .handler(async () => {
      const networks = await listOfficeNetworks();
      return { networks, status: "ok" as const };
    }),

  createOfficeNetwork: adminOnly
    .route({ method: "POST", path: "/office-networks" })
    .input(officeNetworkCreateInputSchema)
    .output(officeNetworkResponseSchema)
    .handler(async ({ input }) => {
      const network = await createOfficeNetwork(input.name, input.cidr);
      return { network, status: "ok" as const };
    }),

  updateOfficeNetwork: adminOnly
    .route({ method: "PUT", path: "/office-networks/{id}" })
    .input(officeNetworkUpdateInputSchema)
    .output(officeNetworkResponseSchema)
    .handler(async ({ input }) => {
      const { id, ...data } = input;
      const network = await updateOfficeNetwork(id, data);
      return { network, status: "ok" as const };
    }),

  deleteOfficeNetwork: adminOnly
    .route({ method: "DELETE", path: "/office-networks/{id}" })
    .input(attendanceMarkIdInputSchema)
    .output(attendanceDeleteResponseSchema)
    .handler(async ({ input }) => {
      await deleteOfficeNetwork(input.id);
      return { status: "ok" as const };
    }),
};

export const attendanceORPCRouter = base
  .prefix("/api/orpc/attendance")
  .tag("Attendance")
  .router(attendanceORPCRouterBase);

export const attendanceORPCHandler = new SuperJSONRPCHandler(attendanceORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("attendance.orpc", error, {});
    }),
  ],
});

export const attendanceOpenAPIHandler = new OpenAPIHandler(attendanceORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Attendance API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Attendance API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("attendance.orpc.openapi", error, {});
    }),
  ],
});

export type AttendanceORPCRouter = typeof attendanceORPCRouter;
