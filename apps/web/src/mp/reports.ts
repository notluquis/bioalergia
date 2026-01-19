export interface Movement {
  amount: number;
  bankId?: string;
  counterparty?: string;
  description?: string;
  direction: "IN" | "NEUTRO" | "OUT";
  from?: string;
  referenceId?: string;
  timestamp: string;
  to?: string;
  transactionId?: string;
}

export function deriveMovements(_rows: string[][], _options: { accountName: string }): Movement[] {
  // Placeholder minimal implementation to satisfy build and lint
  return [];
}

export function firstNumber(values: (number | undefined)[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

export function parseDelimited(text: string): string[][] {
  return text.split("\n").map((line) => line.split(/[,\t]/).map((c) => c.trim()));
}

// src/mp/reports.ts
export function toNumber(value?: string): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Limpia el valor de cualquier carácter que no sea un dígito, coma, punto o signo negativo.
  const cleaned = trimmed
    .replaceAll(/CLP/gi, "")
    .replaceAll("$", "")
    .replaceAll(/\s+/g, "")
    .replaceAll(/[^0-9,.-]/g, "");

  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === ",") return undefined;

  // Heurística para normalizar números con separadores de miles y decimales.
  // Si hay ambos, asumimos que el punto es separador de miles.
  let normalized: string;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    // Si la coma está después del último punto, es el separador decimal.
    normalized =
      lastComma > lastDot
        ? cleaned.replaceAll(".", "").replace(",", ".")
        : cleaned.replaceAll(",", "");
  } else {
    normalized = cleaned.replaceAll(",", ".");
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}
