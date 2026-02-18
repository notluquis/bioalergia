/**
 * Servicio para obtener valores de UF desde API CMF Chile
 * Documentación: https://api.cmfchile.cl/api-sbifv3/
 */
import { z } from "zod";
import { apiClient } from "@/lib/api-client";

// Cache en memoria para valores UF
const UF_CACHE = new Map<string, number>();

const CmfUfResponseSchema = z.object({
  UFs: z.array(
    z.object({
      Fecha: z.string(),
      Valor: z.string(),
    }),
  ),
});

/**
 * Parsea valor UF con formato chileno (ej: "38.123,45") a número
 * @param valor - Valor con formato chileno (punto para miles, coma para decimales)
 * @returns Número parseado
 */
function parseUFValue(valor: string): number {
  // Eliminar puntos (separador de miles) y reemplazar coma por punto (decimal)
  const normalized = valor.replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(normalized);
}

/**
 * Obtiene el valor de la UF para una fecha específica
 * @param date - Fecha en formato YYYY-MM-DD
 * @returns Valor de la UF
 */
export async function getUFValue(date: string): Promise<number> {
  // Revisar cache
  const cached = UF_CACHE.get(date);
  if (cached) return cached;

  try {
    const [year, month, day] = date.split("-");

    // API CMF - formato JSON
    const apiKey = import.meta.env.VITE_CMF_API_KEY || "37849dd7e45182bc8882322036016466dec20efc";
    const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf/${year}/${month}/dias/${day}?apikey=${apiKey}&formato=json`;

    const data = await apiClient.get<{ UFs: Array<{ Fecha: string; Valor: string }> }>(url, {
      credentials: "omit",
      responseSchema: CmfUfResponseSchema,
    });

    if (!data.UFs || data.UFs.length === 0) {
      throw new Error(`No UF value found for date ${date}`);
    }

    const ufData = data.UFs[0];
    if (!ufData) {
      throw new Error(`No UF data for date ${date}`);
    }

    const valor = parseUFValue(ufData.Valor);

    // Guardar en cache
    UF_CACHE.set(date, valor);

    return valor;
  } catch (error) {
    console.error(`Error fetching UF value for ${date}:`, error);
    // Retornar valor por defecto en caso de error (UF aproximada actual)
    return 38500; // Valor por defecto aproximado para 2026
  }
}

/**
 * Obtiene múltiples valores UF de forma eficiente
 * @param dates - Array de fechas YYYY-MM-DD
 * @returns Map de fecha -> valor UF
 */
export async function getUFValues(dates: string[]): Promise<Map<string, number>> {
  const uniqueDates = [...new Set(dates)];
  const results = await Promise.all(uniqueDates.map((date) => getUFValue(date)));

  const map = new Map<string, number>();
  for (const [index, date] of uniqueDates.entries()) {
    const value = results[index];
    if (value !== undefined) {
      map.set(date, value);
    }
  }

  return map;
}
