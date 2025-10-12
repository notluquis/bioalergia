import express from "express";
import { asyncHandler } from "../lib/http.js";

export function registerAssetRoutes(app: express.Express) {
  // Proxy simple para imágenes remotas (logo) evitando CORS en el cliente
  app.get(
    "/api/assets/proxy-image",
    asyncHandler(async (req, res) => {
      const url = String(req.query.url || "");
      try {
        if (!url || !/^https?:\/\//i.test(url)) {
          return res.status(400).json({ status: "error", message: "URL inválida" });
        }

        const u = new URL(url);
        // Restringir protocolo
        if (!(u.protocol === "http:" || u.protocol === "https:")) {
          return res.status(400).json({ status: "error", message: "Protocolo no permitido" });
        }

        // Descargar imagen
        const resp = await fetch(u, { redirect: "follow" });
        if (!resp.ok) {
          return res.status(502).json({ status: "error", message: `No se pudo obtener la imagen (${resp.status})` });
        }

        const contentType = resp.headers.get("content-type") || "application/octet-stream";
        const buf = Buffer.from(await resp.arrayBuffer());

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=300"); // 5 minutos
        res.send(buf);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Fallo proxy de imagen";
        res.status(500).json({ status: "error", message });
      }
    })
  );
}
