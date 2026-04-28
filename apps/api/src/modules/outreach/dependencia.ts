import type { OutreachDependencia } from "@finanzas/orpc-contracts/outreach";

export function mapDependencia(codDepe2: string | number | null | undefined): OutreachDependencia {
  const code = String(codDepe2 ?? "").trim();
  switch (code) {
    case "1":
      return "MUNICIPAL";
    case "2":
      return "PARTICULAR_SUBVENCIONADO";
    case "3":
      return "PARTICULAR_PAGADO";
    case "4":
      return "SLEP";
    case "5":
      return "CORPORACION_MUNICIPAL";
    default:
      return "OTRO";
  }
}
