/**
 * Servicio para obtener valores de UF desde API CMF Chile (Backend)
 * Documentación: https://api.cmfchile.cl/api-sbifv3/
 */

// Cache en memoria para valores UF
const UF_CACHE = new Map<string, number>();

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
    const apiKey = process.env.CMF_API_KEY;
    const url = `https://api.cmfchile.cl/api-sbifv3/recursos_api/uf/${year}/${month}/dias/${day}?apikey=${apiKey}&formato=json`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API CMF error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      UFs: Array<{ Valor: string; Fecha: string }>;
    };

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

    console.log(`[CMF UF] Fetched UF value for ${date}: ${valor}`);

    return valor;
  } catch (error) {
    console.error(`[CMF UF] Error fetching UF value for ${date}:`, error);
    // Retornar valor por defecto en caso de error (UF aproximada actual)
    return 38500; // Valor por defecto aproximado para 2026
  }
}
