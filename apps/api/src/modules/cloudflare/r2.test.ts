/**
 * `r2KeyFromCdnUrl` — deriva la key R2 de una CDN URL pública para poder borrar
 * el objeto (y las variantes del srcset) al eliminar una imagen.
 */
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.CF_R2_PUBLIC_BASE_URL = "https://cdn.bioalergia.cl";
});

const { r2KeyFromCdnUrl } = await import("./r2.ts");

describe("r2KeyFromCdnUrl", () => {
  it("extrae la key de una URL del CDN configurado", () => {
    expect(r2KeyFromCdnUrl("https://cdn.bioalergia.cl/products/5/abc-800w.webp")).toBe(
      "products/5/abc-800w.webp"
    );
  });

  it("tolera barra final en la base", () => {
    expect(r2KeyFromCdnUrl("https://cdn.bioalergia.cl/clinic/logo/x.png")).toBe(
      "clinic/logo/x.png"
    );
  });

  it("devuelve null para URLs de otro origen", () => {
    expect(r2KeyFromCdnUrl("https://otro.com/x.webp")).toBeNull();
  });
});
