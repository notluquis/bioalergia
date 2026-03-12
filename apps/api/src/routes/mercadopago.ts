import { Hono, type Context } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { MercadoPagoService } from "../services/mercadopago";
import { errorReply } from "../utils/error-reply";

const app = new Hono();

async function ensureMercadoPagoReadAccess(c: Context) {
  const user = await getSessionUser(c);
  if (!user) {
    return errorReply(c, 401, "No autorizado", { code: "UNAUTHORIZED" });
  }

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) {
    return errorReply(c, 403, "Forbidden", { code: "FORBIDDEN" });
  }

  return null;
}

async function handleReportDownload(c: Context, type: "release" | "settlement") {
  const accessError = await ensureMercadoPagoReadAccess(c);
  if (accessError) {
    return accessError;
  }

  const fileName = c.req.param("fileName");
  if (!fileName) {
    return errorReply(c, 400, "Nombre de archivo requerido", { code: "BAD_REQUEST" });
  }

  try {
    const response = await MercadoPagoService.downloadReport(type, fileName);
    const contentType = response.headers.get("content-type") ?? "text/csv; charset=utf-8";
    const contentDisposition =
      response.headers.get("content-disposition") ??
      `attachment; filename="${encodeURIComponent(fileName)}"`;

    return new Response(response.body, {
      headers: {
        "Content-Disposition": contentDisposition,
        "Content-Type": contentType,
      },
      status: response.status,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Download failed: 404")) {
      return errorReply(c, 404, "Recurso no encontrado.", { code: "NOT_FOUND" });
    }

    throw error;
  }
}

app.get("/reports/download/:fileName", (c) => handleReportDownload(c, "release"));
app.get("/settlement/reports/download/:fileName", (c) => handleReportDownload(c, "settlement"));

export const mercadopagoRoutes = app;
