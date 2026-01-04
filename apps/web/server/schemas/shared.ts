/**
 * Shared schema utilities and primitives
 * Used across multiple domain schemas
 */
import { z } from "zod";

// Regex patterns
export const colorRegex = /^(?:#(?:[0-9a-fA-F]{3}){1,2}|(?:oklch|hsl|rgb|var)\(.+\))$/;
export const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
export const timeRegex = /^\d{2}:\d{2}$/;
export const monthRegex = /^\d{4}-\d{2}$/;

// URL schemas
export const httpsUrlSchema = z
  .string()
  .trim()
  .url({ message: "Debe ser una URL válida" })
  .refine((value) => value.startsWith("https://"), {
    message: "Debe comenzar con https://",
  });

export const optionalHttpsUrl = z.union([z.literal(""), httpsUrlSchema]);

export const brandAssetUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) =>
      value.startsWith("https://") || value.startsWith("/uploads/") || (value.startsWith("/") && value.length > 1),
    {
      message: "Debe comenzar con https:// o una ruta interna que inicie con /",
    }
  );

// Numeric schemas
export const moneySchema = z.coerce.number().min(0);
export const clpInt = z.coerce.number().int().safe().default(0);

export const amountSchema = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) => {
    if (value == null) return null;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return Number.NaN;
      return Math.trunc(value);
    }
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      return Number.NaN;
    }
    return parsed;
  })
  .refine((value) => value == null || (Number.isInteger(value) && value >= 0 && value <= 100_000_000), {
    message: "Monto inválido",
  })
  .optional();
