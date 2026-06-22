import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { AccountContract } from "@finanzas/orpc-contracts/account";
import type { CartContract } from "@finanzas/orpc-contracts/cart";
import type { CatalogContract } from "@finanzas/orpc-contracts/catalog";
import type { CheckoutContract } from "@finanzas/orpc-contracts/checkout";
import type { OccupationalContract } from "@finanzas/orpc-contracts/occupational";
import type { PollenContract } from "@finanzas/orpc-contracts/pollen";
import type { ReactivosContract } from "@finanzas/orpc-contracts/reactivos";
import type { SiteAuthContract } from "@finanzas/orpc-contracts/site-auth";
import type { SiteContentContract } from "@finanzas/orpc-contracts/site-content";
import type { VerificationContract } from "@finanzas/orpc-contracts/verification";

import { siteSuperJSONLink } from "@/lib/superjson-link";

export const catalogClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "catalog", "rpc"],
}) as ContractRouterClient<CatalogContract>;

export const cartClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "cart", "rpc"],
}) as ContractRouterClient<CartContract>;

export const checkoutClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "checkout", "rpc"],
}) as ContractRouterClient<CheckoutContract>;

export const siteAuthClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "site-auth", "rpc"],
}) as ContractRouterClient<SiteAuthContract>;

export const accountClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "account", "rpc"],
}) as ContractRouterClient<AccountContract>;

// Verificación pública de documentos (recetas/certificados) — sin auth.
export const verificationClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "verification", "rpc"],
}) as ContractRouterClient<VerificationContract>;

// Contenido editable del site (exámenes, inmunoterapia, botiquín, polen,
// fundación, quiz, noticias) — DB-backed, lectura pública sin auth.
export const siteContentClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "site-content", "rpc"],
}) as ContractRouterClient<SiteContentContract>;

// Venta a empresas (B2B): vitrina pública de reactivos (sin precio) + captación
// de leads "Quiero reactivos". Ambos endpoints públicos sin auth.
export const reactivosClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "reactivos", "rpc"],
}) as ContractRouterClient<ReactivosContract>;

// Pronóstico de polen para Concepción (gramíneas en vivo + calendario). Público.
export const pollenClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "pollen", "rpc"],
}) as ContractRouterClient<PollenContract>;

// Salud ocupacional (B2B): captación de leads. createLead público sin auth.
export const occupationalClient = createORPCClient(siteSuperJSONLink, {
  path: ["api", "orpc", "occupational", "rpc"],
}) as ContractRouterClient<OccupationalContract>;
